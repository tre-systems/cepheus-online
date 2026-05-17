# Architecture

Cepheus Online is a full-stack TypeScript application with a small browser
client and server-authoritative game rooms.

## Layers

```text
src/shared/      domain types, commands, events, projectors, rules
src/server/      Cloudflare Worker routes and Durable Objects
src/client/      browser app, Canvas board, CSS, local reactive state
data/            canonical bundled ruleset JSON
docs/            design, architecture, engineering, and provenance notes
```

## Runtime Model

The server owns game truth. Clients submit commands. The room validates each
command against current state, appends one or more events, projects the next
state, and broadcasts a state-bearing message.

This is a CQRS-style split: commands are the only mutation path, while reads
return filtered projections from the event stream.

Larger runtime diagrams live in [docs/diagrams](../diagrams/README.md):

- [Runtime architecture](../diagrams/runtime-architecture.png)
- [Command publication flow](../diagrams/command-publication-flow.png)
- [Viewer filtering and reveal flow](../diagrams/viewer-filtering-reveal-flow.png)

## Durable Objects

`GameRoomDO` is the Cloudflare lifecycle shell for one live campaign/game room.
It owns platform entrypoints, but ordered command processing, accepted/rejected
response shaping, viewer-safe broadcasts, reveal scheduling, event storage,
checkpoints, and state queries live in focused helpers under
`src/server/game-room/`.

Keep the room class small. New room behavior should extend the command,
publication, broadcast, reveal-scheduling, storage, or query helpers rather than
adding feature logic directly to `GameRoomDO`. Game rules live in `src/shared`,
not in the Durable Object class.

D1-backed Worker routes own private-beta Discord sessions, rooms,
memberships, invites, and uploaded asset metadata. `GameRoomDO` trusts only the
Worker-provided user and viewer-role headers on hosted requests; legacy query
viewer parameters remain for local/test-host workflows.

Ruleset selection is room state. `CreateGame` may carry a `rulesetId`,
`GameCreated` persists it, and `GameState.rulesetId` is projected from the
event stream. Rulesets are resolved through a provider boundary that returns
decoded JSON data plus id, version, content hash, and source metadata. The
canonical bundled ruleset is `data/rulesets/cepheus-engine-srd.json`. Cepheus
rules live as JSON under `data/rulesets/`; do not convert rules tables into
hand-maintained TypeScript constants.

## Persistence

- Durable Object storage: live event stream, checkpoints, reveal scheduling
  state, and active room metadata.
- D1: users, app sessions, rooms, room memberships, room invites, and uploaded
  asset metadata.
- R2: uploaded board and counter images, addressed through protected asset ids.
- Future D1/R2 additions: public listings, audit metadata, and final archived
  game bundles.

Event streams should be chunked in Durable Object storage rather than kept as
one large array. Checkpoints should be saved at natural boundaries so reconnect
and replay read the latest checkpoint plus a short event tail.

## Client

The browser client should prefer:

- plain DOM and CSS
- Canvas 2D for boards and maps
- small local signals/reactive utilities
- browser WebSocket and Fetch
- no runtime UI framework by default

The current shell source is in `src/client/app` and is embedded into
Worker-served assets with `npm run build:client`. The Worker serves the
generated asset module from `src/server` without importing client source at
runtime.

The app entrypoint should remain thin. Runtime identity, socket/fetch handling,
command routing, dice reveal coordination, and feature rendering belong behind
`createAppClient()`.

The app is a PWA. The shell owns install metadata, a web app manifest, service
worker registration, controller-change reload, and an install prompt. The
service worker may cache only app-shell assets and navigations; room state,
commands, health checks, and future API routes must always go to the network.

WebGL can be introduced later for a specific board mode, not as the default.

## State Boundaries

Separate state into:

- authoritative game state projected from events
- local UI state that can be discarded
- ephemeral presence/awareness
- server-ordered notes and handouts for MVP table play
- optional future collaborative document state if notes need CRDT behavior

These must not be blurred into one mutable object.

Character creation projection has a stable public boundary in
`createCharacterEventHandlers()`. The handlers behind that boundary are split by
creation lifecycle area: setup/homeworld, career entry and term flow, risk
events, mustering, finalization, and character-sheet facts. Keep future
projection changes behind that composition point so replay, legality, viewer
filtering, and client read models keep one source of truth.

## Source Boundaries

`src/shared` should be side-effect-free and deterministic. `src/server` owns
Cloudflare bindings and persistence. `src/client` owns DOM, Canvas, CSS,
browser storage, and WebSocket client behavior.

See [patterns.md](patterns.md) and
[coding standards](../engineering/coding-standards.md). See
[map assets and line of sight](map-assets-and-los.md) for the local-only
geomorph asset policy and occlusion sidecar model.
