# Implementation Backlog

This is the active engineering backlog for Cepheus Online. It turns the latest
Delta-V architecture review into work streams that can be picked up by multiple
agents without trampling each other. Shipped work belongs in `git log`; this
file is for active or future work that still needs a named home.

Last reviewed: 2026-05-05.

## Delta-V Learnings Applied

The reviewed Delta-V sources were strongest in these areas:

- one composition root that wires the browser client
- typed client command routing with exhaustive handlers
- raw input translated into pure input events before it reaches game logic
- server publication through one persistence, checkpoint, parity, and broadcast
  path
- event projectors split by domain with an exhaustive event registry
- contract fixtures for protocol shapes
- deterministic RNG derived from match seed and event sequence
- zero-framework reactive state used selectively, not as a global store
- active backlog streams with explicit write ownership for parallel agents
- fast local checks plus heavier smoke, accessibility, and simulation gates

Cepheus Online should adopt those patterns where they fit the campaign-tabletop
product. It should not copy Delta-V game rules, renderer modules, AI, rating,
leaderboard, or quick-match systems.

## Parallel Work Streams

Use these streams when several agents are working from `main`. Each stream lists
its primary write area. Agents should avoid another stream's write area unless
the handoff is explicit.

### Agent A: Client Kernel And Input Pipeline

Goal: retire the current `app.ts` monolith and make browser behavior easier to
change safely.

Primary write ownership:

- `src/client/app/app.ts`
- new client kernel/session/router modules under `src/client/app/`
- `src/client/app/board-controller.ts`
- `src/client/app/room-menu-controller.ts`
- `src/client/app/character-sheet-controller.ts`
- `src/client/app/character-creation-*.ts`
- focused client tests

Tasks:

- Introduce a `createAppClient()` composition root that wires DOM elements,
  room API, WebSocket, PWA install, board controller, sheet controller, dice
  overlay, and character creation.
- Add a small `AppSession` aggregate for durable client state: authoritative
  `GameState`, room identity, viewer role, selected board/piece, open panels,
  active character creation flow, and transient request state.
- Move command submission into a single client command router with an
  exhaustive handler map for board, dice, door, sheet, asset, and character
  creation commands.
- Split canvas and button input into a three-layer path: DOM/canvas capture,
  pure input interpretation, then command routing.
- Keep local planning state separate from authoritative state: drag previews,
  open modal state, form drafts, and pending dice animation are discardable.
- Remove `// @ts-nocheck` from `src/client/app/app.ts` by shrinking the file and
  giving each extracted module typed dependencies.
- Ensure each stateful client manager exposes a `dispose()` path when it owns
  listeners, effects, timers, or sockets.

Acceptance:

- `app.ts` becomes a thin boot file or composition shell.
- All game-truth commands pass through one router before hitting the room API.
- Board input, sheet actions, dice rolls, and character creation actions are
  testable without a browser.
- No authoritative state is mutated directly in the browser.

### Agent B: Publication And Projection Hardening

Goal: make command acceptance, persistence, projection, and broadcasting as
deterministic as Delta-V's single publication pipeline.

Primary write ownership:

- `src/server/game-room/command.ts`
- `src/server/game-room/publication.ts`
- `src/server/game-room/projection.ts`
- `src/server/game-room/storage.ts`
- `src/shared/projector.ts`
- `src/shared/events.ts`
- server and projector tests

Tasks:

- Split the large `projectGameState` switch into domain projectors with an
  exhaustive event-handler registry.
- Define and implement a clear projection parity policy. Avoid the bad middle
  ground where an event has already been appended but the client receives a
  rejected command because parity failed.
- Keep one state-bearing response per accepted command and one server-side
  filtering path for HTTP responses, WebSocket broadcasts, and future replay
  views.
- Move checkpoint decisions into named policy helpers with Cepheus boundaries:
  game creation, character creation completion, map scene changes, combat round
  boundaries, and larger event-count intervals.
- Add a publication test that reconstructs from checkpoint plus tail after every
  new event family.
- Add telemetry hooks or structured test seams for projection mismatch,
  invalid command, and stale command outcomes without logging secrets.

Acceptance:

- A new event type cannot compile without projector support.
- Stored projection and live projection are checked consistently.
- Accepted commands always return the state that can be recovered from storage.
- Viewer-safe state is never assembled in more than one ad hoc path.

### Agent C: Protocol Contracts And Validation

Goal: make commands, events, and state-bearing messages stable wire contracts,
not just TypeScript shapes.

Primary write ownership:

- `src/shared/protocol.ts`
- `src/shared/commands.ts`
- `src/shared/events.ts`
- `src/shared/state.ts`
- protocol fixtures under colocated `__fixtures__/` directories
- protocol and validation tests

Tasks:

- Add JSON contract fixtures for representative client command envelopes,
  server responses, event envelopes, and viewer-filtered state.
- Add negative fixtures for malformed command types, malformed ids, unknown
  viewer roles, stale `expectedSeq`, oversize arrays or strings, and invalid
  character creation payloads.
- Promote recurring id and serialized-key boundaries into branded constructors
  where plain strings are easy to mix up.
- Keep validation staged: cheap shape and size checks before command
  publication, command validation before event derivation, projection checks
  after persistence.
- Make command errors stable enough for the client to branch on categories
  such as `stale_command`, `invalid_command`, `missing_entity`, and
  `not_allowed`.

Acceptance:

- Protocol fixture tests catch accidental wire-shape changes.
- Client and server share one command/event/message vocabulary.
- User mistakes return typed errors; programmer or corrupt-storage failures are
  the only throw paths.

### Agent D: Character Creation Procedure

Goal: build the full Cepheus character creation mini-game on top of the
server-ordered command/event spine.

Primary write ownership:

- `docs/product/character-creation-backlog.md`
- `src/shared/character-creation/`
- character creation command/event/projection code
- `src/client/app/character-creation-*.ts`
- character sheet integration tests

Tasks:

- Work through the dedicated
  [character creation backlog](character-creation-backlog.md), starting with
  homeworld, background skills, and cascade selection.
- Model character creation as a derived step view model: current status,
  prompt, legal actions, pending selections, recent result, and sheet preview.
- Connect every character creation roll to the shared dice system so connected
  players see the same animation and result.
- Persist semantic creation events, not whole-character snapshots.
- Add fixture-backed end-to-end scenarios for characteristics, homeworld,
  failed qualification to Draft, one successful term, mustering out, and
  finalization.

Acceptance:

- A player can create a valid character end to end on a phone.
- Refresh reconstructs the current creation state and final sheet from events.
- Every rules action is either legal and visible or impossible to trigger.

### Agent E: PWA, Connectivity, And Release Hygiene

Goal: bring the browser install/update experience and developer checks closer
to Delta-V without adding runtime dependencies.

Primary write ownership:

- `src/client/app/service-worker.ts`
- `src/client/app/pwa-install.ts`
- new client connectivity/update helpers
- `scripts/`
- `.github/workflows/`
- engineering docs

Tasks:

- Add a dependency-free version/update check so installed PWA users can refresh
  when the Worker and static assets move to a new build.
- Add a small connectivity controller for offline/online state and failed
  reconnect feedback.
- Keep the service worker conservative: cache shell assets, serve an offline
  shell fallback, and never cache room commands, state reads, health checks, or
  auth/session routes.
- Add a documentation link checker or equivalent lightweight doc hygiene gate.
- Add a deploy-secret preflight script so local and CI deploy failures explain
  missing Cloudflare configuration clearly.
- Split verification into quick and full gates once browser smoke tests become
  heavy enough to justify it.
- Add mobile PWA manual checks to the testing docs: install, reload, offline
  shell, update, and reconnect.

Acceptance:

- PWA install and update behavior is predictable on mobile.
- Docs links and deploy config fail early with actionable messages.
- Heavy checks are available without making every small docs change expensive.

### Agent F: Map Assets, LOS, And Referee Scene Tools

Goal: turn local geomorph and counter assets into practical referee scene setup
without committing licensed assets.

Primary write ownership:

- `src/shared/mapAssets.ts`
- `src/client/app/map-asset-*.ts`
- `src/client/app/door-los-view.ts`
- board/piece creation flows
- map asset docs and tests

Tasks:

- Keep `Geomorphs/` and `Counters/` as ignored local inputs only.
- Build validated metadata sidecars for local assets instead of copying image
  contents into git.
- Add a referee asset picker that can create boards from geomorph defaults and
  pieces from counter defaults.
- Expand LOS sidecar validation for walls, doors, bounds, duplicate ids, and
  zero-length segments.
- Add a reviewed workflow for deriving walls and doors from standardized
  geomorphs, with manual correction before use.
- Make door open/close commands visible and replayable through the normal event
  stream.

Acceptance:

- Local licensed assets remain untracked.
- Referee setup can use local maps and counters without weakening projection or
  viewer filtering.
- LOS behavior is deterministic and testable from sidecar data plus door state.

### Agent G: Security, Visibility, And Operational Telemetry

Goal: protect hidden referee data and keep Cloudflare behavior observable
without exposing private table content.

Primary write ownership:

- `docs/engineering/security-baseline.md`
- future Discord/session code
- viewer filtering
- command rate limits and validation paths
- smoke and observability scripts

Tasks:

- Expand viewer filtering tests into a matrix for pieces, characters, maps,
  doors, notes, handouts, and future Discord-linked identity.
- Add command and WebSocket rate-limit policy before public rooms accept real
  traffic.
- Add smoke coverage for deployed Worker routes, static assets, room state,
  stale command rejection, viewer filtering, and WebSocket dice broadcast.
- Make production diagnostics summarize sensitive Cloudflare data instead of
  dumping raw IPs, tokens, or hidden game state.
- Document Discord identity and room authorization before enabling it.

Acceptance:

- Player projections never contain referee-only data.
- Public deployment checks prove the hosted app still works as one slice.
- Operational output is useful without leaking table secrets.

## Immediate Ordering

The next best implementation sequence is:

1. Start Agent A's client-kernel extraction around the current behavior. This
   reduces conflict risk before character creation grows further.
2. In parallel, start Agent B/C shared-server tasks for projector registry,
   parity policy, and protocol fixtures, avoiding client files.
3. Resume Agent D with homeworld/background/cascade once the client command
   router shape is clear, or start its shared rules and server events while the
   client extraction is in progress.
4. Keep Agent E's doc-link/deploy preflight tasks small and independent.

For the product goal of a great character generator, Agent D remains the
feature priority. The Delta-V lesson is that the client and publication
structure should be tightened enough that the full character procedure does not
land inside another monolith.
