# Testing Strategy

The current repo has a TypeScript check and a Node-based unit test gate. The
test plan should continue to grow in layers as implementation expands.

## Current Gate

- `npm run check`: TypeScript compile check for `src/**/*.ts`.
- `npm run check:docs`: dependency-free internal Markdown link check for
  root docs, `data/`, and `docs/`.
- `npm run check:boundaries`: dependency-free source-boundary checks for
  direct HTML writes, accidental shared-layer randomness/logging, and new
  `ts-nocheck` files.
- `npm test`: compiles source and co-located `*.test.ts` files to a temporary
  CommonJS build and runs Node's built-in test runner.
- `npm run verify:quick`: rebuilds served client assets, then runs lint,
  documentation checks, boundary checks, and TypeScript.
- `npm run verify:full`: runs `verify:quick` plus the unit test suite.
- Current tests cover shared protocol/dice/projection behavior, event envelope
  versioning, chunk-boundary storage, import boundaries, stale `expectedSeq`
  rejection, Durable Object HTTP flow, Worker static fallback including PWA
  assets and the bundled browser client, and dependency-free client command
  helpers.
- `npm run smoke:deployed`: dependency-free production smoke for a deployed
  Worker URL. It creates a disposable room and verifies health, shell/PWA
  assets, the self-contained `/client/app/app.js` browser bundle, room commands,
  stale command rejection, viewer filtering, and WebSocket broadcasts.

## First Gate

- TypeScript compile check for `src/**/*.ts`.
- Unit tests for `src/shared` projectors, command validation, dice parsing, and
  ruleset loading.
- Unit tests for `src/client/reactive.ts` and `src/client/dom.ts` before UI
  code depends on them heavily.

## Shared Rules

Rules code gets the strictest coverage because it is the replay contract.

Use direct example tests for:

- character generation steps
- career qualification and advancement
- equipment and encumbrance calculations
- damage and healing
- dice notation
- board permissions and visibility

Use property-style tests for invariants:

- projection from events is deterministic
- replaying an event stream twice gives the same state
- dice rolls stay within expected ranges
- equipment totals never go negative after valid commands
- hidden player projections never contain referee-only fields

## Protocol Contracts

Keep canonical JSON fixtures for:

- client-to-server messages
- server-to-client state-bearing messages
- event envelopes
- filtered player/referee/spectator projections

Fixtures should assert wire compatibility, not just TypeScript compatibility.

## Durable Object Tests

Durable Object persistence should be tested with a small in-memory storage fake
before Wrangler integration tests are introduced.

Core cases:

- append events across chunk boundaries
- load latest checkpoint plus event tail
- reject stale commands with `expectedSeq`
- broadcast viewer-safe projections
- recover room state after a simulated hibernation wake

## Browser Tests

Use browser tests only for browser-specific contracts:

- app boots
- Discord login redirect/start page renders
- create/join campaign flows
- multi-tab board sync
- reconnect behavior
- mobile character sheet and board interactions

Game rules and state machines belong in unit tests, not in broad browser
scenarios.

The next browser-test slice should follow the Delta-V pattern:

- an executable character creation smoke that drives the real app shell
- repeat runs that create several disposable travellers and leave screenshots
  or DOM snapshots on failure
- two-tab owner/spectator tests for live character creation follow mode
- mobile viewport checks for the high-risk creator screens
- explicit assertions that roll-dependent results are hidden until the dice
  reveal boundary

Browser tests are allowed to add development dependencies such as Playwright
once the toolchain is selected. That does not change the runtime dependency
budget for the shipped app.

## Local Verification

The target local gate once implementation starts:

```bash
npm run verify:quick
npm run verify:full
npm run test:e2e
```

Keep the fast gate cheap. Add heavier simulation and browser coverage once
there is enough code to justify it.
