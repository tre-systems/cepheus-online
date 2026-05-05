# Implementation Plan

This is the active engineering plan for Cepheus Online. It turns the backlog
into ordered implementation slices while preserving clear ownership for parallel
agents. Shipped work belongs in `git log`; this file is for active or future
work that still needs a named home.

Last reviewed: 2026-05-05.

## North Star

Build a mobile-first Cepheus Engine PWA where a referee can run a tactical scene
and players can create and play valid characters without leaving the app. The
app should keep game truth in a server-ordered event stream, use Discord for
chat and table narrative, and stay dependency-light.

The near-term product target is:

- two tabs can join the same room, move pieces, open doors, roll live dice, and
  recover state after refresh
- a player can create a valid Cepheus character through a step-by-step,
  dice-driven process that feels like the rules procedure
- a referee can use local geomorph/counter assets without committing licensed
  product files
- the deployed Cloudflare Worker, Durable Object, static client, PWA assets, and
  WebSocket dice path are continuously smoke-tested

## Planning Principles

- Character creation is the feature priority, but it must not land inside a
  larger client or server monolith.
- Commands are intent, events are facts, and projections are read models.
- Every state-changing action should flow through one client command router and
  one server publication path.
- Shared rules code must stay deterministic, dependency-free, and free of DOM,
  network, storage, logging, and ambient randomness.
- The browser may keep local planning state, but authoritative game state is
  replaced from server responses.
- Viewer filtering happens server-side before state leaves the room.
- Parallel agents should work in separate write areas and integrate through the
  shared command/event/projection contracts.

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
- active work streams with explicit write ownership for parallel agents
- fast local checks plus heavier smoke, accessibility, and simulation gates

Cepheus Online should adopt those patterns where they fit the campaign-tabletop
product. It should not copy Delta-V game rules, renderer modules, AI, rating,
leaderboard, or quick-match systems.

## Phase 0: Architecture Stabilization

Purpose: make the next feature slices cheaper and safer by tightening the
client and server seams around the current behavior.

This phase can run in parallel across Agents A, B, C, and E.

### Slice 0A: Client Kernel And Command Router

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

Done when:

- `app.ts` is a thin boot file or composition shell.
- All game-truth commands pass through one router before hitting the room API.
- Board input, sheet actions, dice rolls, and character creation actions are
  testable without a browser.
- No authoritative state is mutated directly in the browser.

### Slice 0B: Publication And Projection Hardening

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
- Add publication tests that reconstruct from checkpoint plus tail after every
  new event family.
- Add telemetry hooks or structured test seams for projection mismatch,
  invalid command, and stale command outcomes without logging secrets.

Done when:

- A new event type cannot compile without projector support.
- Stored projection and live projection are checked consistently.
- Accepted commands always return the state that can be recovered from storage.
- Viewer-safe state is never assembled in more than one ad hoc path.

### Slice 0C: Protocol Contracts And Validation

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
- Make command errors stable enough for the client to branch on categories such
  as `stale_command`, `invalid_command`, `missing_entity`, and `not_allowed`.

Done when:

- Protocol fixture tests catch accidental wire-shape changes.
- Client and server share one command/event/message vocabulary.
- User mistakes return typed errors; programmer or corrupt-storage failures are
  the only throw paths.

### Slice 0D: PWA And Release Hygiene

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

Done when:

- PWA install and update behavior is predictable on mobile.
- Docs links and deploy config fail early with actionable messages.
- Heavy checks are available without making every small docs change expensive.

## Phase 1: Character Creation MVP

Purpose: make character creation coherent, visible, and recoverable before
adding the whole career loop.

This phase starts after Slice 0A has established the client command-router
shape. Shared rules and server event work can begin earlier if it avoids client
files.

Primary write ownership:

- `docs/product/character-creation-backlog.md`
- `src/shared/character-creation/`
- character creation command/event/projection code
- `src/client/app/character-creation-*.ts`
- character sheet integration tests

### Slice 1A: Wizard Usability

Tasks:

- Add a clear creation header with current phase, current prompt, and the next
  primary action.
- Keep quick/manual character creation secondary to the step-by-step wizard.
- Show the compact one-line characteristic strip throughout the flow.
- Surface stale/rejected command recovery as a small actionable message.
- Ensure every visible roll uses the shared dice renderer.

Done when:

- A new player can understand the next action on a phone-sized viewport.
- No creation action appears before its prerequisites are met.
- Refresh recovers the current creation state from the room projection.

### Slice 1B: Homeworld, Background Skills, And Cascade Choices

Tasks:

- Extend character creation projection with homeworld, background skills, and
  pending cascade selections.
- Add commands and events for setting homeworld data and resolving background
  skill selections.
- Port or confirm pure helpers for primary education, homeworld-derived skills,
  background skill allowance, and cascade resolution.
- Add mobile UI controls for law level, trade code, primary education, and
  background skill selection.
- Add a cascade skill modal that blocks progress until resolved.
- Add command, event, projector, protocol, and client view-model tests.

Done when:

- Character creation cannot enter career selection until background choices are
  complete.
- Skills gained from homeworld/background are visible with provenance.
- Cascade choices survive refresh and resolve through server events.

### Slice 1C: Career Entry, Draft, And Basic Training

Tasks:

- Move career entry onto explicit server-backed commands and events.
- Prevent normal qualification into careers already left, except for allowed
  Drifter behavior.
- Apply previous-career qualification penalties.
- On failed qualification, expose only Drifter or the Draft.
- Implement the Draft as a 1d6 ruleset table roll.
- Implement first-term basic training and later new-career basic training.
- Persist drafted terms and clear draft eligibility after draft use.

Done when:

- Failed qualification produces Drifter or Draft, matching the legacy app.
- Draft result is determined by a visible roll and persisted in the event
  stream.
- Basic training updates skills with provenance and refresh recovery.

## Phase 2: Full Character Generation

Purpose: complete the Cepheus character creation mini-game end to end.

### Slice 2A: Career Term Loop

Tasks:

- Promote term state into server projection: career, rank, title, drafted flag,
  basic training, survival, commission, advancement, skills, mishap, and term
  completion.
- Implement survival rolls and failure outcomes.
- Implement mishap and death handling from the ruleset.
- Implement commission and advancement, including rank/title/bonus skill
  rewards.
- Implement term skill table selection and roll resolution.
- Enforce outstanding selection gates for cascade, commission, promotion, and
  term skills.
- Add compact term-history cards.

Done when:

- A normal successful term can be completed using only visible legal actions.
- Failed survival produces a valid mishap or death outcome.
- Term history matches the event stream after refresh.

### Slice 2B: Aging, Anagathics, And Reenlistment

Tasks:

- Wire aging helpers into server-backed commands and events.
- Use the correct aging modifier from term count and anagathics use.
- Present legal aging characteristic loss choices only when required.
- Persist characteristic changes with term provenance.
- Implement optional anagathics survival and cost/payment flow.
- Implement reenlistment, including mandatory retirement after seven terms,
  forced reenlistment on 12, allowed reenlistment, and blocked reenlistment.

Done when:

- Aging cannot be skipped when required.
- Reenlistment outcomes are deterministic and visible.
- The player can continue, leave, retire, or be forced by the rules.

### Slice 2C: Mustering Out And Final Sheet

Tasks:

- Implement benefit count calculation from completed terms and rank.
- Implement cash and material benefit rolls from the ruleset.
- Apply cash limits and benefit modifiers.
- Persist credits, starting credits, and material benefits.
- Support continuing into a new career after mustering out when rules allow.
- Finalize only when gates pass: at least one term, legal exit, no outstanding
  selections, and no unresolved death/mishap branch.
- Project the final playable sheet from creation state and finalization.
- Add UPP/export display for completed characters.

Done when:

- A character can be created from first roll through final playable sheet.
- Mustering choices and benefits are replayable from the event stream.
- The final sheet is valid without manual cleanup.

## Phase 3: Tactical Table And Referee Scene Tools

Purpose: make the board useful for a real table session.

Primary write ownership:

- `src/shared/mapAssets.ts`
- `src/client/app/map-asset-*.ts`
- `src/client/app/door-los-view.ts`
- board/piece creation flows
- map asset docs and tests
- future referee mode surfaces

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
- Add prep/admin mode, richer piece/character visibility controls, and direct
  board management.

Done when:

- Local licensed assets remain untracked.
- Referee setup can use local maps and counters without weakening projection or
  viewer filtering.
- LOS behavior is deterministic and testable from sidecar data plus door state.
- A referee can prepare and run a basic tactical scene without editing JSON.

## Phase 4: Table Security, Discord, And Deployment Confidence

Purpose: make public rooms and hosted play safe enough to use with real players.

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
- Document and implement Discord identity, room authorization, and invite flow.
- Log player-relevant game and character creation events to Discord when
  integration is enabled. Do not build in-app chat.

Done when:

- Player projections never contain referee-only data.
- Public deployment checks prove the hosted app still works as one slice.
- Discord identifies players and carries the table narrative without replacing
  the board, dice, or sheets.
- Operational output is useful without leaking table secrets.

## Phase 5: Cepheus Rules Breadth

Purpose: move beyond character generation into the broader rules helpers needed
for play.

Tasks:

- Port skill roll helpers, difficulty modifiers, and action roll presentation.
- Port combat, damage, healing, armor, initiative, and status calculations as
  pure shared rules helpers.
- Replace simple equipment text with item-level equipment commands/events and a
  ledger/export path.
- Add character action-sheet controls that use skills, equipment, cover, stance,
  fatigue, and status.
- Add notes and handouts as server-ordered blocks, with CRDTs only if a concrete
  document-collaboration need appears.

Done when:

- Player-facing character sheets support common play actions directly.
- Equipment and ledger changes are event-sourced rather than whole-list edits.
- Tactical combat helpers match the old app's expected behavior and are covered
  by rules tests.

## Immediate Execution Plan

The next batch should run like this:

1. Start Slice 0A locally first. It reduces merge risk before character
   creation grows and gives all later UI work a command-router target.
2. In parallel, assign Slice 0B and Slice 0C to separate agents because they
   mostly touch shared/server contracts and tests.
3. Start Slice 1B shared rules and server event design in parallel, but hold
   major client wiring until Slice 0A defines the router/session shape.
4. Keep Slice 0D small and independent: doc-link check, deploy preflight, and
   PWA update/connectivity work can land without waiting for the character
   flow.

The first product-visible milestone after this batch is: homeworld/background
character creation with cascade resolution, visible dice, refresh recovery, and
the current board/dice flow still working.

## Do Not Start Yet

- In-app chat. Discord is the chat and narrative log.
- CRDTs for notes before a concrete collaborative editing need exists.
- React, Material UI, Amplify, DataStore, XState, Zustand, or a schema-form UI.
- Public Discord room authorization before viewer filtering and rate limits are
  tightened.
- Large Cepheus combat UI before the character creation and board scene flows
  are stable.
