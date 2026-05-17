#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const configPath = resolve('wrangler.jsonc')
const config = JSON.parse(readFileSync(configPath, 'utf8'))

const databaseBindings = Array.isArray(config.d1_databases)
  ? config.d1_databases
  : []
const unresolvedBindings = databaseBindings.filter(
  (binding) =>
    typeof binding.database_name === 'string' &&
    (!binding.database_id || binding.database_id === 'set-in-cloudflare')
)

if (unresolvedBindings.length === 0) {
  console.log('Cloudflare D1 database ids are already resolved.')
  process.exit(0)
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const rawList = execFileSync(npxCommand, ['wrangler', 'd1', 'list', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit']
})
const databases = JSON.parse(rawList)

if (!Array.isArray(databases)) {
  throw new Error('wrangler d1 list --json did not return an array')
}

for (const binding of unresolvedBindings) {
  const database = databases.find(
    (candidate) =>
      candidate.name === binding.database_name ||
      candidate.database_name === binding.database_name
  )
  const databaseId =
    database?.uuid ?? database?.id ?? database?.database_id ?? null

  if (typeof databaseId !== 'string' || databaseId.length === 0) {
    throw new Error(
      `Could not resolve D1 database id for ${binding.database_name}. Create the database or set database_id in wrangler.jsonc.`
    )
  }

  binding.database_id = databaseId
  console.log(
    `Resolved ${binding.binding} to D1 database ${binding.database_name}.`
  )
}

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
