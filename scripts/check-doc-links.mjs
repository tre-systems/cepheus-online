#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docRoots = ['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'data', 'docs']

const markdownFiles = []

const isMarkdown = (path) => path.endsWith('.md')

const walk = (path) => {
  const absolutePath = resolve(root, path)
  let stats

  try {
    stats = statSync(absolutePath)
  } catch {
    return
  }

  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolutePath)) {
      walk(join(path, entry))
    }
    return
  }

  if (stats.isFile() && isMarkdown(path)) {
    markdownFiles.push(path)
  }
}

for (const docRoot of docRoots) {
  walk(docRoot)
}

const slugify = (heading) =>
  heading
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')

const normalizeRelativePath = (path) =>
  relative(root, path).split(sep).join('/')

const stripCodeSpans = (line) =>
  line.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length))

const collectAnchors = (file) => {
  const text = readFileSync(resolve(root, file), 'utf8')
  const anchors = new Set()
  const slugCounts = new Map()
  let inFence = false

  for (const line of text.split('\n')) {
    if (/^```/.test(line)) {
      inFence = !inFence
      continue
    }

    if (inFence) {
      continue
    }

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match) {
      continue
    }

    const slug = slugify(match[2])
    const count = slugCounts.get(slug) ?? 0
    slugCounts.set(slug, count + 1)
    anchors.add(count === 0 ? slug : `${slug}-${count}`)
  }

  return anchors
}

const anchorsByFile = new Map()

for (const file of markdownFiles) {
  anchorsByFile.set(file, collectAnchors(file))
}

const errors = []
const linkPattern = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

for (const file of markdownFiles) {
  const absoluteFile = resolve(root, file)
  const lines = readFileSync(absoluteFile, 'utf8').split('\n')
  let inFence = false

  lines.forEach((line, index) => {
    if (/^```/.test(line)) {
      inFence = !inFence
      return
    }

    if (inFence) {
      return
    }

    const strippedLine = stripCodeSpans(line)

    for (
      let match = linkPattern.exec(strippedLine);
      match !== null;
      match = linkPattern.exec(strippedLine)
    ) {
      const href = match[1]

      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
        continue
      }

      const [pathPart, anchorPart] = href.split('#')
      const anchor = anchorPart ? decodeURIComponent(anchorPart) : ''
      const targetPath = pathPart || file
      const absoluteTarget = resolve(dirname(absoluteFile), targetPath)
      const relativeTarget = normalizeRelativePath(absoluteTarget)

      try {
        statSync(absoluteTarget)
      } catch {
        errors.push(
          `${file}:${index + 1} missing file ${href} -> ${relativeTarget}`
        )
        continue
      }

      if (!anchor || !isMarkdown(relativeTarget)) {
        continue
      }

      const anchors =
        anchorsByFile.get(relativeTarget) ?? collectAnchors(relativeTarget)
      if (!anchors.has(anchor)) {
        errors.push(
          `${file}:${index + 1} missing anchor ${href} in ${relativeTarget}`
        )
      }
    }
  })
}

if (errors.length > 0) {
  console.error(
    `check-doc-links: found ${errors.length} broken internal link(s):`
  )
  for (const error of errors) {
    console.error(`  ${error}`)
  }
  process.exit(1)
}

console.log(`check-doc-links: checked ${markdownFiles.length} markdown files`)
