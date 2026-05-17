#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const result = spawnSync(
  process.execPath,
  ['scripts/build-client.mjs', '--check'],
  {
    stdio: 'inherit'
  }
)

if (result.error) {
  console.error(
    `Generated client freshness check failed: ${result.error.message}`
  )
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
