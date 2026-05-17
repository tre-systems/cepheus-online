#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const input = readFileSync(0, 'utf8')
const paths = input
  .split(/\r?\n/)
  .map((path) => path.trim())
  .filter(Boolean)

const isDocPath = (path) =>
  path === 'README.md' ||
  path === 'CONTRIBUTING.md' ||
  path === 'AGENTS.md' ||
  path.startsWith('docs/')

process.exit(paths.length > 0 && paths.every(isDocPath) ? 0 : 1)
