# Source Layout

The source tree starts intentionally small.

```text
src/shared/  deterministic domain types, commands, events, projectors, schemas
src/server/  Cloudflare Worker routes and Durable Objects, added later
src/client/  browser DOM, Canvas, CSS, WebSocket client, and local UI state
```

## Boundaries

- `src/shared` must stay side-effect-free: no DOM, network, storage, logging, or
  ambient randomness.
- `src/server` may import `src/shared`, but must not import `src/client`.
- `src/client` may import `src/shared`, but must not import `src/server`.

## Current Skeleton

- `src/shared/commands.ts`: initial command union.
- `src/shared/events.ts`: initial event union and event envelope.
- `src/shared/projector.ts`: event-to-state projection.
- `src/shared/schemas/`: salvaged entity JSON schema definitions.
- `src/client/reactive.ts`: zero-dependency signals and disposal scopes.
- `src/client/dom.ts`: small DOM helper layer and trusted HTML boundary.
