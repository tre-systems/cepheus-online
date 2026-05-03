import {describe, it} from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'

const sourceRoot = 'src'

type Boundary = {
  readonly from: string
  readonly forbidden: readonly string[]
}

type Violation = {
  readonly file: string
  readonly specifier: string
  readonly resolved: string
}

const boundaries: readonly Boundary[] = [
  {from: 'shared', forbidden: ['server', 'client']},
  {from: 'server', forbidden: ['client']}
]

const sourceFiles = (directory: string): string[] => {
  const files: string[] = []

  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...sourceFiles(fullPath))
      continue
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(fullPath)
    }
  }

  return files
}

const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const importSpecifiers = (source: string): string[] => {
  const specifiers: string[] = []
  const withoutImports = withoutComments(source)
  const importPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of withoutImports.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined) {
      specifiers.push(specifier)
    }
  }

  return specifiers
}

const resolveLocalImport = (file: string, specifier: string): string | null => {
  if (specifier.startsWith('.')) {
    return path.normalize(path.resolve(path.dirname(file), specifier))
  }

  if (specifier.startsWith(`${sourceRoot}/`)) {
    return path.normalize(path.resolve(specifier))
  }

  return null
}

const firstSourceSegment = (resolved: string): string | null => {
  const relativePath = path.relative(path.resolve(sourceRoot), resolved)

  if (relativePath.startsWith('..')) {
    return null
  }

  return relativePath.split('/')[0] ?? null
}

const violationsFor = (boundary: Boundary): Violation[] => {
  const violations: Violation[] = []

  for (const file of sourceFiles(path.join(sourceRoot, boundary.from))) {
    const source = fs.readFileSync(file, 'utf8')

    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveLocalImport(file, specifier)
      if (resolved === null) {
        continue
      }

      const importedSegment = firstSourceSegment(resolved)
      if (importedSegment !== null && boundary.forbidden.includes(importedSegment)) {
        violations.push({
          file,
          specifier,
          resolved: path.relative(sourceRoot, resolved)
        })
      }
    }
  }

  return violations
}

describe('import boundaries', () => {
  for (const boundary of boundaries) {
    const forbiddenDescription = boundary.forbidden
      .map((segment) => `src/${segment}`)
      .join(' or ')

    it(`keeps src/${boundary.from} from importing ${forbiddenDescription}`, () => {
      const violations = violationsFor(boundary)

      if (violations.length > 0) {
        throw new Error(
          violations
            .map(
              (violation) =>
                `${violation.file} imports ${violation.specifier} (${violation.resolved})`
            )
            .join('\n')
        )
      }
    })
  }
})
