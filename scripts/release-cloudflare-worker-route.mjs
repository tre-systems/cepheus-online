#!/usr/bin/env node

const apiToken = process.env.CLOUDFLARE_API_TOKEN
const zoneName = readArg('--zone')
const routePattern = readArg('--pattern')
const keepScript = readArg('--keep-script')

if (process.argv.includes('--help')) {
  console.log(
    'Usage: release-cloudflare-worker-route.mjs --zone <zone> --pattern <route> --keep-script <worker>'
  )
  process.exit(0)
}

if (!zoneName || !routePattern || !keepScript) {
  throw new Error(
    'Usage: release-cloudflare-worker-route.mjs --zone <zone> --pattern <route> --keep-script <worker>'
  )
}

if (!apiToken) {
  throw new Error('Missing CLOUDFLARE_API_TOKEN')
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function cloudflare(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...init.headers
    }
  })

  const payload = await response.json()

  if (!response.ok || !payload.success) {
    const messages = Array.isArray(payload.errors)
      ? payload.errors
          .map((error) => `${error.code ?? 'error'}: ${error.message}`)
          .join('; ')
      : response.statusText
    throw new Error(`Cloudflare API request failed: ${messages}`)
  }

  return payload.result
}

const zoneSearch = new URLSearchParams({ name: zoneName })
const zones = await cloudflare(`/zones?${zoneSearch}`)
const zone = zones[0]

if (!zone?.id) {
  throw new Error(`Cloudflare zone ${zoneName} was not found`)
}

const routeSearch = new URLSearchParams({ per_page: '100' })
const routes = await cloudflare(
  `/zones/${zone.id}/workers/routes?${routeSearch}`
)
const matchingRoutes = routes.filter((route) => route.pattern === routePattern)
const staleRoutes = matchingRoutes.filter(
  (route) => route.script !== keepScript
)

for (const route of staleRoutes) {
  console.log(
    `Removing stale Worker route ${route.pattern} from ${route.script ?? 'no script'}.`
  )
  await cloudflare(`/zones/${zone.id}/workers/routes/${route.id}`, {
    method: 'DELETE'
  })
}

if (staleRoutes.length === 0) {
  console.log(`No stale Worker routes found for ${routePattern}.`)
}

if (matchingRoutes.some((route) => route.script === keepScript)) {
  console.log(
    `Worker route ${routePattern} is already assigned to ${keepScript}.`
  )
}
