import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const clientRoot = join(root, 'src', 'client', 'app')
const compiledClientRoot = join(root, '.tmp', 'client')
const outputPath = join(
  root,
  'src',
  'server',
  'static-client-assets.generated.ts'
)

const assets = [
  {
    pathname: '/',
    source: 'index.html',
    exportName: 'CLIENT_HTML',
    contentType: 'text/html; charset=utf-8'
  },
  {
    pathname: '/index.html',
    source: 'index.html',
    exportName: 'CLIENT_HTML',
    contentType: 'text/html; charset=utf-8'
  },
  {
    pathname: '/styles.css',
    source: 'styles.css',
    exportName: 'CLIENT_CSS',
    contentType: 'text/css; charset=utf-8'
  },
  {
    pathname: '/client.js',
    inlineBody: 'import "/client/app/app.js";\n',
    exportName: 'CLIENT_JS_COMPAT',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/app.js',
    source: join(compiledClientRoot, 'client', 'app', 'app.js'),
    exportName: 'CLIENT_APP_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/app-elements.js',
    source: join(compiledClientRoot, 'client', 'app', 'app-elements.js'),
    exportName: 'CLIENT_APP_ELEMENTS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/app-location.js',
    source: join(compiledClientRoot, 'client', 'app', 'app-location.js'),
    exportName: 'CLIENT_APP_LOCATION_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/app-command-router.js',
    source: join(compiledClientRoot, 'client', 'app', 'app-command-router.js'),
    exportName: 'CLIENT_APP_COMMAND_ROUTER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/app-bootstrap.js',
    source: join(compiledClientRoot, 'client', 'app', 'app-bootstrap.js'),
    exportName: 'CLIENT_APP_BOOTSTRAP_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/app-session.js',
    source: join(compiledClientRoot, 'client', 'app', 'app-session.js'),
    exportName: 'CLIENT_APP_SESSION_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/board-geometry.js',
    source: join(compiledClientRoot, 'client', 'app', 'board-geometry.js'),
    exportName: 'CLIENT_BOARD_GEOMETRY_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/board-view.js',
    source: join(compiledClientRoot, 'client', 'app', 'board-view.js'),
    exportName: 'CLIENT_BOARD_VIEW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/board-controller.js',
    source: join(compiledClientRoot, 'client', 'app', 'board-controller.js'),
    exportName: 'CLIENT_BOARD_CONTROLLER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/bootstrap-flow.js',
    source: join(compiledClientRoot, 'client', 'app', 'bootstrap-flow.js'),
    exportName: 'CLIENT_BOOTSTRAP_FLOW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-creation-actions.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-creation-actions.js'
    ),
    exportName: 'CLIENT_CHARACTER_CREATION_ACTIONS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-creation-panel.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-creation-panel.js'
    ),
    exportName: 'CLIENT_CHARACTER_CREATION_PANEL_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-command-plan.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-command-plan.js'
    ),
    exportName: 'CLIENT_CHARACTER_COMMAND_PLAN_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-generator-preview.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-generator-preview.js'
    ),
    exportName: 'CLIENT_CHARACTER_GENERATOR_PREVIEW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-sheet-controller.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-sheet-controller.js'
    ),
    exportName: 'CLIENT_CHARACTER_SHEET_CONTROLLER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-sheet-view.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-sheet-view.js'
    ),
    exportName: 'CLIENT_CHARACTER_SHEET_VIEW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/connectivity-controller.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'connectivity-controller.js'
    ),
    exportName: 'CLIENT_CONNECTIVITY_CONTROLLER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/room-socket-controller.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'room-socket-controller.js'
    ),
    exportName: 'CLIENT_ROOM_SOCKET_CONTROLLER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/connectivity.js',
    source: join(compiledClientRoot, 'client', 'app', 'connectivity.js'),
    exportName: 'CLIENT_CONNECTIVITY_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-creation-flow.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-creation-flow.js'
    ),
    exportName: 'CLIENT_CHARACTER_CREATION_FLOW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/character-creation-view.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'character-creation-view.js'
    ),
    exportName: 'CLIENT_CHARACTER_CREATION_VIEW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/dice-overlay.js',
    source: join(compiledClientRoot, 'client', 'app', 'dice-overlay.js'),
    exportName: 'CLIENT_DICE_OVERLAY_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/dice-reveal-state.js',
    source: join(compiledClientRoot, 'client', 'app', 'dice-reveal-state.js'),
    exportName: 'CLIENT_DICE_REVEAL_STATE_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/door-los-view.js',
    source: join(compiledClientRoot, 'client', 'app', 'door-los-view.js'),
    exportName: 'CLIENT_DOOR_LOS_VIEW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/image-assets.js',
    source: join(compiledClientRoot, 'client', 'app', 'image-assets.js'),
    exportName: 'CLIENT_IMAGE_ASSETS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/live-activity-client.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'live-activity-client.js'
    ),
    exportName: 'CLIENT_LIVE_ACTIVITY_CLIENT_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/map-asset-library.js',
    source: join(compiledClientRoot, 'client', 'app', 'map-asset-library.js'),
    exportName: 'CLIENT_MAP_ASSET_LIBRARY_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/map-asset-picker-view.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'map-asset-picker-view.js'
    ),
    exportName: 'CLIENT_MAP_ASSET_PICKER_VIEW_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/piece-command-plan.js',
    source: join(compiledClientRoot, 'client', 'app', 'piece-command-plan.js'),
    exportName: 'CLIENT_PIECE_COMMAND_PLAN_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/pwa-install.js',
    source: join(compiledClientRoot, 'client', 'app', 'pwa-install.js'),
    exportName: 'CLIENT_PWA_INSTALL_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/pwa-update-state',
    source: join(compiledClientRoot, 'client', 'app', 'pwa-update-state.js'),
    exportName: 'CLIENT_PWA_UPDATE_STATE_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/request-id.js',
    source: join(compiledClientRoot, 'client', 'app', 'request-id.js'),
    exportName: 'CLIENT_REQUEST_ID_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/room-api.js',
    source: join(compiledClientRoot, 'client', 'app', 'room-api.js'),
    exportName: 'CLIENT_ROOM_API_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/room-menu-controller.js',
    source: join(
      compiledClientRoot,
      'client',
      'app',
      'room-menu-controller.js'
    ),
    exportName: 'CLIENT_ROOM_MENU_CONTROLLER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/app/service-worker.js',
    source: join(compiledClientRoot, 'client', 'app', 'service-worker.js'),
    exportName: 'CLIENT_SERVICE_WORKER_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/game-commands.js',
    source: join(compiledClientRoot, 'client', 'game-commands.js'),
    exportName: 'CLIENT_GAME_COMMANDS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/client/dice.js',
    source: join(compiledClientRoot, 'client', 'dice.js'),
    exportName: 'CLIENT_DICE_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/mapAssets.js',
    source: join(compiledClientRoot, 'shared', 'mapAssets.js'),
    exportName: 'SHARED_MAP_ASSETS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/live-activity.js',
    source: join(compiledClientRoot, 'shared', 'live-activity.js'),
    exportName: 'SHARED_LIVE_ACTIVITY_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/career-rules.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'career-rules.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_CAREER_RULES_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/career-rules',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'career-rules.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_CAREER_RULES_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/cepheus-srd-ruleset.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'cepheus-srd-ruleset.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_CEPHEUS_SRD_RULESET_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/skills.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'skills.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_SKILLS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/background-skills.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'background-skills.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_BACKGROUND_SKILLS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/benefits.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'benefits.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_BENEFITS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/benefits',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'benefits.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_BENEFITS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/aging.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'aging.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_AGING_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/term-lifecycle.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'term-lifecycle.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_TERM_LIFECYCLE_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/term-lifecycle',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'term-lifecycle.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_TERM_LIFECYCLE_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/character-creation/legal-actions.js',
    source: join(
      compiledClientRoot,
      'shared',
      'character-creation',
      'legal-actions.js'
    ),
    exportName: 'SHARED_CHARACTER_CREATION_LEGAL_ACTIONS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/ids',
    source: join(compiledClientRoot, 'shared', 'ids.js'),
    exportName: 'SHARED_IDS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/ids.js',
    source: join(compiledClientRoot, 'shared', 'ids.js'),
    exportName: 'SHARED_IDS_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/result.js',
    source: join(compiledClientRoot, 'shared', 'result.js'),
    exportName: 'SHARED_RESULT_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/result',
    source: join(compiledClientRoot, 'shared', 'result.js'),
    exportName: 'SHARED_RESULT_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/util.js',
    source: join(compiledClientRoot, 'shared', 'util.js'),
    exportName: 'SHARED_UTIL_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/shared/util',
    source: join(compiledClientRoot, 'shared', 'util.js'),
    exportName: 'SHARED_UTIL_JS',
    contentType: 'text/javascript; charset=utf-8'
  },
  {
    pathname: '/manifest.webmanifest',
    source: 'manifest.webmanifest',
    exportName: 'CLIENT_MANIFEST',
    contentType: 'application/manifest+json'
  },
  {
    pathname: '/site.webmanifest',
    source: 'manifest.webmanifest',
    exportName: 'CLIENT_MANIFEST',
    contentType: 'application/manifest+json'
  },
  {
    pathname: '/manifest.json',
    source: 'manifest.webmanifest',
    exportName: 'CLIENT_MANIFEST',
    contentType: 'application/manifest+json'
  },
  {
    pathname: '/icon.svg',
    source: 'icon.svg',
    exportName: 'CLIENT_ICON',
    contentType: 'image/svg+xml'
  },
  {
    pathname: '/favicon.svg',
    source: 'icon.svg',
    exportName: 'CLIENT_ICON',
    contentType: 'image/svg+xml'
  },
  {
    pathname: '/icon-maskable.svg',
    source: 'icon-maskable.svg',
    exportName: 'CLIENT_MASKABLE_ICON',
    contentType: 'image/svg+xml'
  },
  {
    pathname: '/favicon.ico',
    source: 'icon.svg',
    exportName: 'CLIENT_ICON',
    contentType: 'image/svg+xml'
  },
  {
    pathname: '/apple-touch-icon.svg',
    source: 'icon.svg',
    exportName: 'CLIENT_ICON',
    contentType: 'image/svg+xml'
  },
  {
    pathname: '/sw.js',
    source: 'sw.js',
    exportName: 'CLIENT_SW',
    contentType: 'text/javascript; charset=utf-8'
  }
]

const uniqueSources = new Map()
for (const asset of assets) {
  if (!uniqueSources.has(asset.exportName)) {
    uniqueSources.set(asset.exportName, {
      source: asset.source,
      inlineBody: asset.inlineBody
    })
  }
}

const extractModuleImports = (body) => {
  const imports = new Set()
  const importPattern =
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of body.matchAll(importPattern)) {
    imports.add(match[1] ?? match[2])
  }

  return [...imports]
}

const resolveModulePath = (fromPathname, specifier) => {
  if (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith('/')
  ) {
    throw new Error(`${fromPathname} imports non-runtime module ${specifier}`)
  }

  return new URL(specifier, `https://cepheus.test${fromPathname}`).pathname
}

await rm(compiledClientRoot, { recursive: true, force: true })
execFileSync('npx', ['tsc', '-p', 'tsconfig.client.json'], {
  cwd: root,
  stdio: 'inherit'
})

const lines = [
  '// Generated by scripts/build-client.mjs. Do not edit by hand.',
  ''
]
const sourceBodies = new Map()

for (const [exportName, { source, inlineBody }] of uniqueSources) {
  const body =
    inlineBody ??
    (await readFile(
      typeof source === 'string' && source.startsWith(root)
        ? source
        : join(clientRoot, source),
      'utf8'
    ))
  sourceBodies.set(exportName, body)
}

const buildHash = createHash('sha256')
for (const body of sourceBodies.values()) {
  buildHash.update(body)
}
const shortHash = buildHash.digest('hex').slice(0, 12)

for (const [exportName, rawBody] of sourceBodies) {
  const body = rawBody.replaceAll('__BUILD_HASH__', shortHash)
  lines.push(`export const ${exportName} = ${JSON.stringify(body)}`)
}

const servedPathnames = new Set(assets.map((asset) => asset.pathname))
const javascriptAssets = assets.filter((asset) =>
  asset.contentType.startsWith('text/javascript')
)

for (const asset of javascriptAssets) {
  const body = sourceBodies.get(asset.exportName)
  if (body === undefined) {
    throw new Error(`${asset.pathname} has no generated body`)
  }

  for (const specifier of extractModuleImports(body)) {
    const importedPathname = resolveModulePath(asset.pathname, specifier)
    if (!servedPathnames.has(importedPathname)) {
      throw new Error(
        `${asset.pathname} imports unserved runtime module ${importedPathname}`
      )
    }
  }
}

lines.push(
  '',
  'export const STATIC_CLIENT_ASSETS = {',
  ...assets.map(
    (asset) =>
      `  ${JSON.stringify(asset.pathname)}: {body: ${asset.exportName}, contentType: ${JSON.stringify(asset.contentType)}},`
  ),
  '} as const',
  ''
)

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, lines.join('\n'))
