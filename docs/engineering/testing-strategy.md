# Testing Strategy

The current repo has a TypeScript check and a Node-based unit test gate. The
test plan should continue to grow in layers as implementation expands.

## Current Gate

- `npm run check`: TypeScript compile check for `src/**/*.ts`.
- `npm test`: compiles source and co-located `*.test.ts` files to a temporary
  CommonJS build and runs Node's built-in test runner.
- Current tests cover shared protocol/dice/projection behavior, event envelope
  versioning, chunk-boundary storage, import boundaries, stale `expectedSeq`
  rejection, Durable Object HTTP flow, Worker static fallback including PWA
  assets, and dependency-free client command helpers.

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

## Local Verification

The target local gate once implementation starts:

```bash
npm run check
npm test
npm run build
npm run test:e2e
```

Keep the fast gate cheap. Add heavier simulation and browser coverage once
there is enough code to justify it.
