# Source Layout

The source tree starts intentionally small.

```text
src/shared/  deterministic domain types, commands, events, projectors, rules
src/server/  Cloudflare Worker routes, static client fallback, Durable Objects
src/client/  browser DOM, Canvas, CSS, WebSocket client, and local UI state
```

## Boundaries

- `src/shared` must stay side-effect-free: no DOM, network, storage, logging, or
  ambient randomness.
- `src/server` may import `src/shared`, but must not import `src/client`.
- `src/client` may import `src/shared`, but must not import `src/server`.

## Current Skeleton

- `src/shared/commands.ts`: command union for room state changes.
- `src/shared/events.ts`: event union and event envelope.
- `src/shared/projector.ts`: event-to-state projection, including recent dice.
- `src/shared/protocol.ts`: client/server message validation and wire types.
- `src/server/index.ts`: Worker entrypoint, health route, room routing, and
  static browser fallback.
- `src/client/app/`: dependency-free browser shell, mobile-first PWA metadata,
  icon, service worker, Canvas board, and dice UI source assets. Feature code is
  grouped under short-named folders such as `core/`, `room/`, `board/`,
  `dice/`, `character/`, `activity/`, `assets/`, `piece/`, and `pwa/`; the
  root contains the composition shell and static app assets.
- `src/server/static-client.ts`: static client asset response helper backed by
  generated assets from `npm run build:client`.
- `src/server/game-room/`: `GameRoomDO`, chunked event storage, checkpoints,
  projection reload, and publication flow.
- `src/client/game-commands.ts`: dependency-free command builders and message
  application helpers for browser flows.
- `src/client/reactive.ts`: zero-dependency signals and disposal scopes.
- `src/client/dom.ts`: small DOM helper layer and trusted HTML boundary.
