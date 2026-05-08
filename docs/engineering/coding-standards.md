# Coding Standards

These conventions fit the current Cepheus Online codebase. They borrow the
useful Delta-V patterns, but keep the rules smaller until this repo has a real
client build and deployment pipeline.

## Core Principles

- Keep docs aligned with implementation.
- Prefer readability over cleverness.
- Prefer small, testable extractions over large architectural rewrites.
- Prefer typed data and pure functions in `src/shared`.
- Prefer functions and `createXxx()` factories. Use classes only for platform
  boundaries such as Durable Objects.
- Keep runtime dependencies at zero by default. Development-only tooling is
  allowed when it improves consistency without changing the shipped app.

## Source Boundaries

```text
src/shared/  imports only src/shared
src/server/  imports src/shared and src/server
src/client/  imports src/shared and src/client
```

`src/shared` must remain deterministic and side-effect-free:

- no DOM APIs
- no Fetch, WebSocket, or browser storage
- no Cloudflare storage APIs
- no `Math.random`
- no `console.log`, `console.warn`, or `console.error`

Any random game result must use an injected `rng: () => number` or a
server-derived deterministic RNG.

## CQRS and Event Sourcing

The room model is CQRS-style:

- commands are the only mutation path
- commands validate against current projection
- accepted commands append versioned event envelopes
- state-bearing responses are projections from the event stream
- viewer filtering happens before state leaves the server

Do not add parallel "save current state" paths. If behavior changes game truth,
add a command, an event, projector support, publication tests, and viewer-safe
read coverage.

Commands describe intent:

```ts
{type: 'MovePiece', pieceId, x, y, expectedSeq}
```

Events describe facts:

```ts
{type: 'PieceMoved', pieceId, x, y}
```

The event envelope owns ordering and schema metadata:

```ts
{
  version: 1,
  gameId,
  seq,
  actorId,
  createdAt,
  event
}
```

## Function Shape

Use names that reveal side effects.

| Prefix | Meaning | Side effects |
| --- | --- | --- |
| `derive*` | compute a value from inputs | no |
| `build*` | construct a complex object/message | no |
| `resolve*` | interpret input into a structured result | no |
| `validate*` | check invariants and return typed errors | no |
| `project*` | derive state from events | no |
| `filter*` | derive a restricted view | no |
| `apply*` | mutate local state or perform a side effect | yes |
| `create*` | construct a manager, factory, or entity | maybe |
| `handle*` | react to an HTTP, WebSocket, DOM, or timer event | yes |
| `render*` / `draw*` | update DOM or Canvas | yes |

When an API needs about five or more parameters, prefer a typed options object.
When a helper only needs a few fields of a large type, prefer `Pick<T, K>` or a
small purpose-built interface.

## Types

- Files use kebab-case: `game-room-do.ts`, `import-boundaries.test.ts`.
- Functions use camelCase.
- Types and interfaces use PascalCase.
- Prefer `type` for unions, aliases, intersections, and local object shapes.
- Use `interface` for exported object contracts that may be extended.
- Network and persisted unions use `type` as their discriminator.
- Client-local UI/event variants may use `kind` when they are not wire shapes.
- Exhaustively handle discriminated unions with `switch` and a `never` fallback.

## Results and Errors

Use the local `Result<T, E>` style for parsing, validation, and command
publication:

```ts
if (!result.ok) return result
return ok(value)
```

Do not throw for expected user or player mistakes. Return typed command errors
such as `invalid_command`, `missing_entity`, or `stale_command`. Throw only for
corrupt persisted state or programmer errors.

## Client Code

The Worker-served shell source lives under `src/client/app`. Run
`npm run build:client` after editing it so the generated server asset module
stays current.

PWA behavior belongs in the shell layer. Keep the service worker conservative:
cache static shell assets, use network-first navigation with an offline shell
fallback, and never intercept room commands, state reads, health checks, or API
routes.

Client state has three classes:

- authoritative `GameState` from the server
- local UI/planning state that can be discarded
- transient effects such as toasts, sounds, dice animation, and drag previews

Do not optimistically mutate authoritative state. Submit a command and replace
authoritative state from the accepted server message or a reloaded projection.

Use `src/client/reactive.ts` selectively for durable local UI state that needs
automatic fan-out. It is not a global game store.

## DOM and Canvas

- Prefer text nodes and `textContent` for plain text.
- Keep future `innerHTML` writes behind `src/client/dom.ts`.
- Canvas renderers should separate view computation from drawing when practical.
- Stable board, piece, dice, toolbar, and sheet dimensions should not shift
  during hover or updates.
- Mobile-first layouts must be checked at phone widths before delivery.

## Tests

- Co-locate tests as `*.test.ts`.
- Test command validation, event publication, projection, and viewer filtering
  before browser flows.
- Add storage tests when changing event envelopes, chunking, checkpoints, or
  sequence handling.
- Add static client tests for served HTML/CSS/JS contracts while the client is
  still embedded.
- Browser tests should cover browser-only contracts: boot, multi-tab sync,
  mobile layout, Canvas input, reconnect, and PWA behavior.

## Formatting and Linting

Biome is the formatter and linter. Treat lint and typecheck failures as
blockers.

Generated files such as `src/server/static-client-assets.generated.ts` are not
formatted directly. Regenerate them with `npm run build:client`, then rely on
typecheck and server tests to validate the emitted module.

The local gate is split by cost:

- `npm run verify:quick`: generated client assets, lint, docs, source-boundary
  checks, and TypeScript.
- `npm run verify:full`: `verify:quick` plus the unit test suite.
- `npm run smoke:deployed -- <url>`: deployed Worker smoke after a production
  deploy or deployment-sensitive change.

Husky runs a doc-only fast path for Markdown-only changes and `verify:quick`
for code changes. Set `CEPHEUS_FULL_PRE_PUSH=1` before pushing when you want
the hook to run the full local gate.

`npm run check:boundaries` enforces architecture rules that are easy to miss in
review:

- `innerHTML` writes only in `src/client/dom.ts`
- no `Math.random` in non-test `src/shared`
- no console logging in non-test `src/shared`
- no new `// @ts-nocheck` files while the existing client shell is being
  decomposed

Formatting defaults:

- two-space indentation
- single quotes in TypeScript and JavaScript
- semicolons only where TypeScript/JavaScript needs them
- no trailing commas by default
- 80-column target when practical

Style defaults:

- use `const` unless reassignment is needed
- avoid `var`
- avoid `==`
- avoid non-null assertions
- avoid `any`
- prefer `for...of` over `.forEach()` in owned code
- keep comments sparse and focused on non-obvious intent

## Documentation

Update the owner doc when a change alters behavior or architecture:

- architecture: `docs/architecture/overview.md`
- recurring implementation patterns: `docs/architecture/patterns.md`
- conflict/CQRS/stale-command behavior: `docs/architecture/conflict-model.md`
- coding rules: this file
- local verification: `docs/engineering/testing-strategy.md`
- security and abuse controls: `docs/engineering/security-baseline.md`
- accepted decisions: `docs/adr/`

Link to owner docs instead of duplicating long explanations.
