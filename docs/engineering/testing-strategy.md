# Testing Strategy

Tests should prove the cheapest boundary that can catch the bug. Shared rules,
protocols, and projections belong in unit tests. Browser tests are for browser
contracts such as layout, Canvas input, PWA behavior, two-tab sync, and reveal
timing.

## Current Gates

| Command | Coverage |
| --- | --- |
| `npm run check` | TypeScript compile check. |
| `npm run check:docs` | Internal Markdown file and anchor links for root docs, `data/`, and `docs/`. |
| `npm run check:boundaries` | Source-boundary rules for HTML writes, shared randomness, source logging, raw room APIs, legacy creation reads, ruleset resolver imports, and `ts-nocheck`. |
| `npm test` | Co-located `*.test.ts` files through Node's built-in test runner. |
| `npm run test:e2e:character-creation` | Playwright coverage for deterministic character creation flows, owner/spectator follow, reveal timing, mobile controls, refresh recovery, and finalization. |
| `npm run test:e2e:tactical` | Playwright coverage for board creation, linked pieces, movement, doors, refresh recovery, and hidden-piece filtering. |
| `npm run verify:quick` | Generated client freshness, client rebuild, lint, docs, boundaries, diagrams, and TypeScript. |
| `npm run verify:full` | `verify:quick`, unit tests, character-creation E2E, and tactical-board E2E. |
| `npm run verify` | Alias for `verify:full`; CI uses this. |
| `npm run smoke:deployed -- <url>` | Deployed Worker smoke for health, shell/PWA assets, commands, stale rejection, viewer filtering, and WebSocket broadcasts. |

Use focused E2E scripts when debugging a branch:

- `npm run test:e2e:character-creation:reveal`
- `npm run test:e2e:character-creation:death`
- `npm run test:e2e:character-creation:multi-career`
- `npm run test:e2e:character-creation:repeat`
- `npm run test:e2e:character-creation:mobile`
- `npm run test:e2e:character-creation:finalization`

## What To Test Where

Use unit tests for:

- command validation and typed error categories
- Discord session cookie signing, D1 repositories, Worker auth middleware, and
  protected private-beta routes
- R2 asset upload validation and protected asset serving
- event envelope versioning and protocol fixtures
- projector replay, checkpoint-plus-tail recovery, and parity
- note/handout projection, mutation authorization, and viewer filtering
- viewer filtering and reveal-safe projections
- ruleset JSON decoding and non-default ruleset fixtures
- dice expressions, deterministic RNG, and rules-table helpers
- client view models, command builders, DOM-free controllers, and disposal

Use browser tests for:

- app boot from Worker-served assets
- mobile layout and reachable primary controls
- Canvas pointer input and command dispatch
- two-tab owner/spectator synchronization
- dice reveal timing and redacted pre-reveal text
- refresh/reconnect recovery
- PWA install/update/offline shell behavior
- failure artifacts that make regressions debuggable

Use deployed smoke after publishing or changing Worker/deploy behavior. It
creates a disposable room and does not depend on Playwright.

## Deterministic Browser Runs

Local browser tests may seed a disposable room before the first command:

```text
POST /rooms/:gameId/test/seed
{ "seed": 12345 }
```

That route is accepted only on local/test hosts such as `localhost`,
`127.0.0.1`, and `*.test`; deployed Worker hosts reject it.

## Mobile PWA Manual Checks

Run these on a real phone against a deployed Worker URL or local HTTPS tunnel:

- Install the app and confirm it opens the room shell without browser chrome.
- Reload the installed app and confirm the shell, icons, manifest, and service
  worker still load.
- Go offline, reopen or reload, and confirm the offline shell appears while
  room commands and state reads fail instead of being cached.
- Deploy or switch to a newer build, return online, foreground the app, and
  confirm it refreshes onto the newer Worker/static build.
- While offline, attempt reconnect; return online and confirm reconnect
  feedback clears after WebSocket and room state recovery.

## Change Guidance

- Docs only: `npm run check:docs`.
- Client shell or generated assets: `npm run build:client && npm run verify:quick && npm test`.
- Shared rules, protocol, server, or projection: `npm run verify:full`.
- Deployment-sensitive changes: `npm run verify:full && npm run deploy:dry-run`.
- Release confidence after deploy: `npm run smoke:deployed -- <url>`.

## Private-Beta Manual Checks

Before inviting real tables:

- Sign in through Discord on the deployed origin.
- Create a room, create an invite, accept it in a second browser profile, and
  confirm the member role controls the viewer projection.
- Upload PNG, JPEG, and WebP assets below 10 MB and confirm non-members cannot
  fetch them.
- Create referee-only, player, and public notes; confirm only permitted viewers
  receive each note.
- Export a disposable room, then delete it and confirm later state, command,
  socket, asset, and export requests fail closed.
