# Patterns

These are the implementation patterns to use as the MVP grows. They are adapted
from Delta-V for a Cepheus campaign tool rather than copied as-is.

Each durable pattern should answer three questions:

- what shape the code should take
- where that shape lives in this repository
- why that shape makes later changes safer

## Event-Sourced Room State

Every authoritative mutation in a room should be a command that produces one or
more events. Live state is a projection of the event stream plus optional
checkpoints.

For character creation, semantic events project into read-model fields such as
term facts, legal actions, timeline entries, and final-sheet/export views;
legacy `creation.history` is compatibility-only for replaying old
`CharacterCreationTransitioned` streams.

The public character creation projector export is `createCharacterEventHandlers()`.
It composes lifecycle-focused modules for setup/homeworld, career entry,
risk/aging/injury, mustering, and character sheet/finalization facts. Keep that
export stable so new rules work can split internally without changing replay,
publication, or client read-model call sites.

See [Command publication flow](../diagrams/command-publication-flow.png) for the
full service boundary diagram.

This avoids the old DataStore failure mode where multiple clients raced to
write whole nested objects.

## Event Envelopes

Persist domain events inside an envelope:

```ts
interface EventEnvelope {
  version: typeof EVENT_ENVELOPE_VERSION
  id: EventId
  gameId: GameId
  seq: number
  actorId: UserId | null
  createdAt: string
  event: GameEvent
}
```

The event payload says what happened. The envelope says when, where, and by
whom. `EVENT_ENVELOPE_VERSION` is the event envelope schema version. `seq` is
the ordering source of truth; timestamps are metadata.

## Chunked Persistence

Durable Object storage should not keep one giant event array per room. Use
fixed-size chunks such as:

```text
events:{gameId}:chunk:0
events:{gameId}:chunk:1
eventSeq:{gameId}
eventChunkCount:{gameId}
checkpoint:{gameId}:{seq}
```

Chunking keeps each value below platform limits and makes reconnect tail reads
cheap. Checkpoints should be saved at natural boundaries: session start,
combat/round boundary, character creation completion, or map scene changes.

## Single Publication Pipeline

There should be one server path that:

- validates a command
- calls shared rules code
- appends event envelopes
- saves checkpoints when needed
- reprojects for parity checks
- broadcasts filtered state
- records operational telemetry

Do not add separate "save then broadcast" paths for each feature. That is how
state drift starts.

Current owner modules:

- `src/server/game-room/publication.ts`
- `src/server/game-room/command.ts`
- `src/server/game-room/storage.ts`
- `src/server/game-room/projection.ts`

New server features should add collaborators to the publication path instead of
publishing state from a feature-specific shortcut.

## Side-Effect-Free Shared Code

Everything in `src/shared` should be deterministic and free of DOM, network,
storage, logging, and ambient randomness. Shared rules functions should accept
all inputs explicitly, including `rng: () => number` when dice or random tables
are involved.

This makes rules code testable, replayable, and usable on both client and
server.

Tooling support:

- `npm run check:boundaries` rejects `Math.random` and console side effects in
  non-test `src/shared` files.
- Biome import restrictions stop `src/shared` from importing client or server
  code.

## Rulesets As Data

Rulesets are data, not application structure. Bundled rulesets live as JSON in
`data/rulesets/` and are decoded at the shared rules boundary. The provider
returns decoded data plus id, version, content hash, and source metadata. The
default ruleset is `cepheus-engine-srd`; future custom rulesets should follow
the same load-decode-select path rather than being compiled into TypeScript.

See [Ruleset data flow](../diagrams/ruleset-data-flow.png) for the provider
boundary diagram.

The bundled default is the Cepheus Engine SRD data file. A missing or unknown
ruleset is not permission to fall back to that SRD file, except when a command
or legacy event omitted `rulesetId` entirely and the room is therefore using the
documented default. Once a room records a non-default `rulesetId`, every
projection, legal-action derivation, viewer redaction, and client creation view
should use the resolved ruleset data for that ID.

A room records its ruleset choice through the event stream:

- `CreateGame.rulesetId` selects the ruleset, defaulting to
  `cepheus-engine-srd`.
- `GameCreated.rulesetId` stores the chosen ID.
- `GameState.rulesetId` lets command publication and projected action plans use
  the correct rules data.

Shared rules helpers should accept a ruleset object when behavior depends on
tables, careers, cascade skills, homeworld options, or aging data. Keep default
ruleset imports for convenience wrappers and legacy tests only.

Projected action plans must fail closed when the room ruleset cannot be
resolved. Do not silently substitute the default SRD ruleset for a room that
selected another ruleset; leave legal actions empty until the selected ruleset
data is available and decoded.

Ruleset coverage should prove both the default and non-default paths:

- decoder tests load JSON, reject malformed shapes, and confirm the bundled SRD
  ruleset is the default `cepheus-engine-srd`;
- legal-action tests use a non-SRD JSON fixture for homeworld, cascade, career,
  benefit, or aging data whenever that behavior is ruleset-dependent;
- projection tests inject a resolver for non-SRD room rulesets and assert that
  projected action plans use the resolved data, while unresolved rulesets produce
  empty legal actions;
- viewer tests cover redaction and revealed fallback states without substituting
  SRD data for an unresolved custom ruleset;
- client model/view/controller tests consume projection-supplied legal actions
  and decoded fixture ruleset data rather than duplicating SRD tables locally.

## Viewer-Aware Filtering

Referee state is not just UI chrome. Hidden pieces, unrevealed maps, secret
NPCs, private notes, and GM-only handouts must be removed before any player
socket receives a state update.

Filtering should happen server-side at the broadcast/replay boundary, not in
the browser. Clients should never receive secrets they are not allowed to know.

## Client State

The browser has three state classes:

- authoritative state from the server
- local planning and UI state that can be discarded
- presence/awareness that can be rebuilt after reconnect

Only authoritative state is persisted as game truth. Local planning state is
for hover, selection, draft movement, unsubmitted form work, and temporary
canvas interactions.

## Input Pipeline

Raw browser events should not touch game logic directly:

1. Capture DOM/canvas input and translate it to input events.
2. Interpret input events with current client state in pure functions.
3. Dispatch typed commands through one command router.

The same command router should handle keyboard shortcuts, toolbar buttons,
touch gestures, and canvas interactions.

## Composition Root And Feature Managers

The browser should be wired from a single composition root. Feature modules
should receive dependencies through small typed objects and expose narrow
manager APIs.

```ts
const creation = createCharacterCreationController({
  getState,
  commandRouter,
  diceRevealCoordinator,
  panel,
  render
})
```

Use this pattern when a module owns listeners, timers, sockets, effects, or
mutable local UI state. Such modules should expose `dispose()` when they create
resources that outlive one render call.

Avoid tiny factories that only rename a callback or wrap one call site. Keep
that wiring inline until the helper owns lifecycle, policy, validation, or
reuse.

Current target:

- `src/client/app/app.ts` remains a boot entrypoint.
- `createAppClient()` remains the browser runtime boundary for room identity,
  fetch/socket flow, command dispatch, dice reveal coordination, and render
  orchestration.
- Character creation orchestration stays behind the creation feature and
  controller APIs, with ruleset data, state, command, and reveal dependencies
  injected from the app client.
- Board, sheet, room menu, socket, PWA, dice, and creator modules should keep
  narrow manager APIs and expose `dispose()` when they own listeners, timers, or
  effects.

## Dependency Injection

Pure functions take direct inputs or a typed options object. Side-effecting
modules take a dependency object.

Use callable getters for state that changes over time:

```ts
const deps = {
  getState: () => appSession.authoritativeState,
  dispatchCommand,
  showError
}
```

Use stable references for services that do not change, such as a command router
or panel manager. This keeps modules testable without importing browser globals
or reaching across source boundaries.

## Derive, Plan, Apply

Prefer a functional core with an imperative shell:

- `derive*` computes view models, legal actions, labels, dimensions, and plans.
- `build*` constructs commands, protocol messages, or complex values.
- `resolve*` interprets input into a structured result.
- `apply*`, `handle*`, `render*`, and `draw*` own side effects.

The character creator should follow this shape especially strictly:

1. derive legal creation actions from the server projection
2. render those actions from a single view model
3. submit intent through the command router
4. apply the accepted projection after dice reveal timing allows it

This avoids the stale-local-flow class of bugs where the browser keeps
rendering an action that the server has already advanced past.

## Tiny Reactive Layer

Use `src/client/reactive.ts` selectively for UI state that needs automatic
fan-out. It is not a global game store. Authoritative state arrives from the
server; signals make local views update without pulling in React, MUI, or a
large state library.

Any view or controller that creates effects, listeners, or timers should own a
disposal scope and expose `dispose()`.

Good candidates:

- durable local UI state such as online/offline, PWA update availability,
  selected local panel, and pending install prompt
- view-local derivations that update several DOM nodes from the same local
  state

Poor candidates:

- authoritative game truth
- replay or projection state that should be replaced from the server
- one-shot outcomes such as dice sounds or transient spectator cards

When using signals, keep them close to the view/controller that owns them.
Do not pass signals through the entire client graph as a substitute for
explicit dependencies.

When a controller has several signals that describe one local UI snapshot,
update them with `batch()` so effects never observe an impossible intermediate
state. This matters for feature-level renderers such as character creation:
opening a followed traveller should publish the selected character, flow, and
read-only state as one change.

Do not introduce Preact, React, Next.js, or another browser framework just to
avoid direct DOM calls. The preferred architecture is dependency-free feature
controllers with pure `derive*` functions and narrow `render*` shells. A
framework dependency needs an ADR-level reason, such as a proven reduction in
complexity that cannot be achieved with the local reactive layer.

## Dice Reveal Coordination

Roll-bearing commands have a stricter presentation contract than normal
commands: players and spectators should not see roll-dependent results until
the shared dice reveal point.

The server owns the observable boundary. It may persist the full dice result
immediately for ordering and recovery, but every HTTP state read, command
response, WebSocket broadcast, and live activity must pass through the same
viewer-aware public projection before it leaves the Durable Object. Before
`revealAt`, public state treats the roll as pending: the browser may receive
the roll id, expression, reason/activity, actor, and reveal time, but not dice
values, totals, success/failure text, or roll-derived character sheet fields.
Character creation reveal checks must not depend only on the capped live
`diceLog`; use the semantic creation timeline as the fallback reveal source
when an older source roll is no longer retained in the live log.
After `revealAt`, the public projection may include the result and derived
consequences.

The client should consume that public projection through one dice reveal
coordinator:

- accept live dice activity or the latest dice log entry
- start the shared dice animation
- avoid applying pre-reveal command responses as if they were final results
- refetch or accept a post-reveal room-state broadcast after the reveal boundary
- unblock the triggering action after the revealed public projection is applied
- resolve refresh/recovery without losing authoritative state

Feature views should not each implement their own reveal timers. They should
ask the coordinator whether a result is pending, revealing, or revealed.

## Browser UX Automation

Most rules and state-machine behavior belongs in unit tests. Browser tests are
for contracts that require a browser:

- the app boots from served Worker assets
- mobile layouts keep primary actions reachable
- canvas and pointer input produce commands
- two tabs see compatible state and dice timing
- PWA install/update/offline shell behavior works
- character creation result text does not appear before dice reveal

Browser failures should leave actionable artifacts: current room id, actor id,
creation status, console errors, recent command errors, and a screenshot or DOM
snapshot. Without those artifacts, the test recreates the manual debugging loop
instead of replacing it.

## DOM Boundary

Use `src/client/dom.ts` for simple views. Keep all `innerHTML` writes behind
`setTrustedHTML()` and `clearHTML()`. Player names, chat, notes, SRD text, and
Discord content should render as text unless a sanitizer is deliberately added
at that boundary.

## Protocol

Network messages should be discriminated unions keyed by `type`. Runtime
validation should happen before a message reaches command handling.

Every successful state-changing command should broadcast exactly one
state-bearing message. Clients replace their authoritative state wholesale.
Avoid optimistic mutation for game truth; use local planning state for fast UI
feedback.
