#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const sourceFiles = []

const normalizePath = (path) => path.split(sep).join('/')

const walk = (path) => {
  const absolutePath = resolve(root, path)
  const stats = statSync(absolutePath)

  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolutePath)) {
      walk(join(path, entry))
    }
    return
  }

  if (stats.isFile() && path.endsWith('.ts')) {
    sourceFiles.push(normalizePath(path))
  }
}

walk('src')

const isTestFile = (path) => path.endsWith('.test.ts')
const isGeneratedFile = (path) => path.endsWith('.generated.ts')
const rawRoomApiImportAllowed = new Set([
  'src/client/app/app.ts',
  'src/client/app/room/command-dispatch.ts'
])
const legacyCreationHistoryReadAllowed = new Set([
  'src/client/app/character/creation/projection.ts'
])

const failures = []

const addFailure = (path, lineNumber, message, line) => {
  failures.push({
    path,
    lineNumber,
    message,
    line: line.trim()
  })
}

const checkLinePattern = ({ path, lines, pattern, message }) => {
  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      addFailure(path, index + 1, message, line)
    }
  }
}

for (const path of sourceFiles) {
  if (isGeneratedFile(path)) {
    continue
  }

  const text = readFileSync(resolve(root, path), 'utf8')
  const lines = text.split('\n')

  if (!isTestFile(path)) {
    checkLinePattern({
      path,
      lines,
      pattern: /^\s*\/\/\s*@ts-nocheck\b/,
      message: 'new ts-nocheck files are not allowed'
    })
  }

  if (path.startsWith('src/client/') && path !== 'src/client/dom.ts') {
    checkLinePattern({
      path,
      lines,
      pattern: /\.innerHTML\s*=/,
      message: 'use src/client/dom.ts trusted HTML helpers'
    })
  }

  if (
    path.startsWith('src/client/app/') &&
    !isTestFile(path) &&
    !rawRoomApiImportAllowed.has(path)
  ) {
    checkLinePattern({
      path,
      lines,
      pattern:
        /import\s+\{[^}]*\b(fetchRoomState|postRoomCommand)\b[^}]*\}\s+from\s+['"].*\/room\/api(?:\.js)?['"]/,
      message:
        'feature modules must use room/command-dispatch instead of raw room HTTP helpers'
    })
  }

  if (
    path.startsWith('src/client/app/character/creation/') &&
    !isTestFile(path) &&
    !legacyCreationHistoryReadAllowed.has(path)
  ) {
    checkLinePattern({
      path,
      lines,
      pattern: /\bcreation\.history\b/,
      message:
        'character creation client modules must use projection read models instead of legacy creation history'
    })
  }

  if (path.startsWith('src/shared/') && !isTestFile(path)) {
    checkLinePattern({
      path,
      lines,
      pattern: /\bMath\.random\b/,
      message: 'shared code must use injected or server-derived RNG'
    })
    checkLinePattern({
      path,
      lines,
      pattern: /\bconsole\.(log|warn|error)\b/,
      message: 'shared code must not log as a side effect'
    })
  }
}

if (failures.length > 0) {
  console.error(`check-boundaries: found ${failures.length} violation(s):`)
  for (const failure of failures) {
    const location = `${failure.path}:${failure.lineNumber}`
    console.error(`  ${location} ${failure.message}`)
    console.error(`    ${failure.line}`)
  }
  process.exit(1)
}

console.log(
  `check-boundaries: checked ${sourceFiles.length} TypeScript files under ${relative(
    root,
    resolve(root, 'src')
  )}`
)
