# Development Standards

This document owns dependency, boundary, and architecture standards. Day-to-day
code style, naming, CQRS/event-sourcing conventions, and formatting rules live
in [Coding Standards](coding-standards.md).

## Dependency Policy

The default runtime dependency budget is zero. A dependency needs a clear
reason to exist:

- correctness is hard to reproduce locally, such as a mature CRDT library
- the surface area is small and well maintained
- it does not dictate the application's architecture
- it is isolated behind a local adapter

UI frameworks, component kits, schema form builders, and generic state
libraries are not default choices for this rewrite.

## Source Boundaries

```text
src/shared/  imports only src/shared
src/server/  imports src/shared and src/server
src/client/  imports src/shared and src/client
```

Rules, validation, projection, and data transforms live in `src/shared`.
Cloudflare APIs live in `src/server`. DOM, Canvas, CSS, browser storage, and
WebSocket client code live in `src/client`.

## Function Shape

Prefer plain functions and `createXxx()` factories. Use classes only when the
platform requires them, such as a Cloudflare Durable Object class.

Good names should reveal side effects:

- `deriveXxx`: pure calculation from existing data
- `buildXxx`: pure construction of a value or view model
- `validateXxx`: pure validation
- `applyXxx`: performs a mutation or side effect
- `createXxx`: constructs a stateful boundary with a `dispose()` method when
  needed

## Shared Rules Code

Shared rules code must not call:

- DOM APIs
- Fetch or WebSocket APIs
- Cloudflare storage APIs
- `Math.random`
- `console.log`, `console.warn`, or `console.error`

Pass `rng: () => number` into any rule that rolls dice or chooses randomly.
Use `deriveEventRng(gameSeed, eventSeq)` when a server event needs deterministic
randomness.

## Validation and Results

Use discriminated unions for commands, events, client messages, and server
messages. Add exhaustive `switch` checks when handling them.

For parsing and validation, prefer a small result shape:

```ts
type Result<T, E = string> =
  | {ok: true; value: T}
  | {ok: false; error: E}
```

Do not throw for expected player mistakes. Throw for impossible programmer
errors and corrupt persisted state.

## Tests

Co-locate tests next to code as `*.test.ts`. Use `*.property.test.ts` for
invariants once a test runner is introduced. Keep protocol fixtures in
`__fixtures__` directories near the validators that consume them.

Use data-driven tests for tables: skills, careers, equipment, dice modifiers,
movement ranges, visibility transitions, and permission matrices.

## Documentation

Docs are part of the implementation. Update the relevant owner doc when a
decision changes:

- `docs/architecture/overview.md` for system shape
- `docs/architecture/conflict-model.md` for sync and conflict rules
- `docs/integrations/discord.md` for auth and Discord integration
- `docs/architecture/patterns.md` for implementation patterns
- `docs/engineering/testing-strategy.md` for verification strategy
- `docs/engineering/security-baseline.md` for access and abuse controls
- `docs/adr/` for accepted architectural decisions
