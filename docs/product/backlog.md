# Implementation Plan

This is the active engineering plan for Cepheus Online. It turns the backlog
into ordered implementation slices while preserving clear ownership for parallel
agents. Shipped work belongs in `git log`; this file is for active or future
work that still needs a named home.

Last reviewed: 2026-05-15.

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
- other connected players can follow character creation as it happens,
  including shared dice animations, terse outcome cards, and refresh recovery
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
- Character creation should be driven by an explicit shared state machine:
  commands request legal transitions, events record accepted facts, projections
  expose current state, and the client renders only legal next actions.
- Manual sheet edits are not a character creation path. Player sheet patches are
  notes-only; referee corrections may patch creation-owned fields when needed.
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
- dev-only esbuild bundling for the dependency-free browser client
- zero-framework reactive state used selectively, not as a global store
- active work streams with explicit write ownership for parallel agents
- fast local checks plus heavier smoke, accessibility, and simulation gates

Cepheus Online should adopt those patterns where they fit the campaign-tabletop
product. It should not copy Delta-V game rules, renderer modules, AI, rating,
leaderboard, or quick-match systems.

## Delivery Order

The backlog is ordered so architectural leverage comes before visible breadth.
Each wave should make later work simpler, safer, or more testable.

1. Finish the architecture seams that are already partially present: thin
   client composition root, one command router, one server publication pipeline,
   one projection/filter path, and protocol fixtures.
2. Keep new character creation work on semantic commands/events while
   preserving historical generic transition replay. Commands remain intent,
   events record accepted facts with dice and outcome data, and
   compatibility-only generic facts stay fenced from new production writes.
3. Keep moving the server projection toward the source of truth for every
   creation gate:
   pending choices, legal actions, term facts, final sheet fields, and refresh
   recovery.
4. Complete and harden the SRD career term loop in order: qualification,
   draft, basic training, survival/death, commission, advancement, term skills,
   aging, reenlistment, mustering out, and finalization.
5. Add optional branches after the default loop is authoritative:
   mishap-variant support, full anagathics survival/cost handling,
   multi-career continuations, richer final sheet/export display, and
   provenance.
6. Layer live following on top of semantic events, a planned viewer-filtering
   contract, and centralized reveal timing so connected players see dice and
   compact outcome cards without creating another source of truth.
7. Polish the mobile PWA experience once the flow shape is stable.
8. Expand tactical board, map, LOS, referee, Discord, and rules breadth after
   the core table loop is solid.
9. Make high-risk UX flows executable in browser automation before continuing
   broad UI polish, so stale-state, reveal-timing, and mobile layout bugs are
   found by repeatable runs instead of manual probing.

Work should pause before a later wave if the earlier wave reveals an
architecture issue that would make the next features harder to reason about.

## Parallel Workstreams

The slices below can run in parallel when ownership stays separated. Each
stream should keep changes inside its write area, integrate through the shared
command/event/projection contracts, and avoid taking dependencies on another
stream's unmerged local work.

### Stream A: Command Spine And Architecture Consolidation

Purpose: make the command path easier to extend without weakening the single
publication pipeline.

Owns:

- Slice 0B: Publication And Projection Hardening
- Slice 0C: Protocol Contracts And Validation, for command wire contracts
- Slice 0H: Architecture Consolidation, for command metadata maintenance and
  the remaining handler split

Primary write area:

- `src/server/game-room/command.ts`
- new server command-handler modules under `src/server/game-room/`
- `src/server/game-room/publication.ts`
- `src/client/app/core/command-router.ts`
- `src/shared/commands.ts`
- command-focused protocol fixtures and tests

Parallel boundaries:

- Do not change character creation UI rendering in this stream.
- Do not add new SRD rules branches here unless they are needed to preserve an
  existing command while splitting handlers.
- Use the shared command metadata registry when adding or changing commands;
  coordinate registry changes before other streams depend on new policy.

Done when:

- Command handling is split by game, board, dice, and character creation
  domains while `runCommandPublication()` remains the only persistence path.
- Route/domain, seeded-dice, and stale-sequence policy continue to come from
  the shared metadata source instead of repeated command-type lists.

### Stream B: Character Creation Projection And Rules State

Purpose: make the server projection the source of truth for every creation
gate and visible next action.

Owns:

- Slice 1A: Semantic Commands And Events, for remaining semantic facts
- Slice 1B: Server Projection And Legal Actions
- Slice 1D: Homeworld, Background Skills, And Cascade Choices
- Slice 1E: Career Entry, Draft, And Basic Training
- Phase 2 rules slices when they add projection-owned gates

Primary write area:

- `src/shared/character-creation/`
- `src/shared/projection/character-creation.ts`
- `src/shared/events.ts`
- character creation command validation helpers
- projector, rules, and checkpoint-plus-tail tests

Parallel boundaries:

- Do not reshape the rendered wizard DOM directly; expose projection/read-model
  fields for Stream C to consume.
- Coordinate with Stream A before adding command metadata requirements.
- Coordinate with Stream D before adding roll-bearing facts that need reveal
  metadata or follower cards.

Done when:

- Pending choices, legal actions, roll requirements, remaining term skills,
  remaining mustering benefits, and completion gates survive refresh from the
  event stream.
- Final sheet fields for age, characteristics, skills, ranks/titles, career
  history, credits, equipment/material benefits, UPP/export, and provenance are
  derived from creation projection and finalization rather than trusted client
  sheet submissions.
- Optional-branch rules that affect the aggregate, including anagathics
  survival/costs and optional mishaps, are expressed as deterministic shared
  rules plus semantic events before they appear in the UI.
- Illegal creation commands reject from projected rules state before
  persistence.

### Stream C: Client Creator UX And App Shell

Purpose: keep the browser client understandable while making character
creation usable on phone-sized viewports.

Owns:

- Slice 0A: Client Kernel And Command Router, for `app.ts` and local wiring
- Slice 0F: Automated UX Regression And Creation Client Architecture, for
  feature shape and renderer architecture
- Slice 1C: Wizard Usability
- Slice 2E: Final Sheet And Export, for client presentation and export display

Primary write area:

- `src/client/app/app.ts`
- `src/client/app/core/`
- `src/client/app/character/creation/`
- `src/client/app/character/sheet/`
- client view-model, renderer, and action tests

Parallel boundaries:

- Consume projection/read-model fields from Stream B instead of duplicating
  rules gates in the browser.
- Use command dispatch and metadata from Stream A; do not add direct room API
  shortcuts from feature modules.
- Leave reveal redaction policy to Stream D and consume its revealed/pending
  model.

Done when:

- `app.ts` remains a composition shell and character creation is mounted,
  refreshed, and disposed through one feature boundary.
- Step views consume one projection-fed model for phase, legal actions,
  progress, roll facts, and completion gates.
- The creator always has an obvious next required action on a phone viewport,
  including background cascades, term skills, aging choices, reenlistment,
  mustering, death, finalization, and “start another character” paths.
- Completed-character presentation is good enough for table use: readable
  characteristics, sorted skills, career history, benefits, credits,
  equipment, notes/provenance, UPP, and a plain export block.

### Stream D: Viewer Filtering, Dice Reveal, And Live Following

Purpose: ensure connected players see compatible, viewer-safe state and
roll-dependent details only after the reveal boundary.

Owns:

- Slice 0D: Live Activity And Dice Broadcast Contract
- Slice 0G: Viewer Filtering And Reveal Timing Contract
- Slice 2F: Live Following
- Browser reveal/follow scenarios from Slice 0F

Primary write area:

- `src/shared/viewer.ts`
- `src/shared/live-activity.ts`
- `src/shared/protocol.ts`, for viewer-filtered message fixtures
- `src/client/app/dice/`
- `src/client/app/activity/`
- `src/client/app/character/creation/follow.ts`
- browser/E2E reveal and spectator-follow tests

Parallel boundaries:

- Coordinate with Stream B for any new roll-bearing semantic event fields.
- Do not alter command validation or publication semantics except where needed
  to carry filtered live activity through the existing publication response.
- Do not duplicate reveal timers inside feature views; keep timing on
  `diceRevealCoordinator`.

Done when:

- HTTP state reads, HTTP command responses, WebSocket broadcasts, live
  activities, refreshes, and new spectator joins all enforce the same reveal
  and viewer-filtering contract.
- Two-tab creator/spectator journeys cover multi-term creation without
  pre-reveal result leakage.
- Spectator follow mode remains useful from first characteristic through
  finalization: selected followed traveller, projected steps, compact outcome
  cards, and final sheet all update without requiring close/reopen.

### Stream E: PWA, Verification, And Release Hygiene

Purpose: keep the deployed Worker, static client, and installed PWA reliable
without blocking core rules work.

Owns:

- Slice 0E: PWA And Release Hygiene
- Phase 4 deployment smoke and diagnostics tasks that do not require Discord
  identity yet

Primary write area:

- `src/client/app/pwa/`
- `src/client/app/core/connectivity*`
- `scripts/`
- `.github/workflows/`
- `docs/engineering/testing-strategy.md`
- `docs/engineering/deployment.md`

Parallel boundaries:

- Do not change game protocol or command behavior in this stream.
- Keep browser tests focused on shell, update, reconnect, and deployment smoke
  unless coordinating with Stream D.

Done when:

- Installed-PWA update, offline shell, reconnect, and deployed smoke behavior
  are documented and repeatable.

### Stream F: Tactical Table And Referee Scene Tools

Purpose: expand the board into a practical referee table surface after the
core command/projection spine stays stable.

Owns:

- Phase 3: Tactical Table And Referee Scene Tools
- Board and asset parts of Phase 5 when they are independent from character
  rules

Primary write area:

- `src/shared/mapAssets.ts`
- `src/client/app/assets/`
- `src/client/app/board/`
- board, LOS, door, and local asset tests
- map asset docs

Parallel boundaries:

- Do not start broad referee prep/admin UI until Streams A-D have stabilized
  the command, projection, and viewer-filtering contracts.
- Keep local `Geomorphs/` and `Counters/` as ignored inputs; do not copy
  licensed assets into git.

Done when:

- Referee setup can create boards, pieces, doors, and LOS sidecars through
  event-backed flows without weakening viewer filtering.

### Stream G: Security, Discord, And Broader Rules

Purpose: prepare public play and post-character-creation rules without pulling
focus from the core table loop too early.

Owns:

- Phase 4: Table Security, Discord, And Deployment Confidence, for identity
  and authorization work
- Phase 5: Cepheus Rules Breadth

Primary write area:

- `docs/engineering/security-baseline.md`
- future Discord/session modules
- future equipment, ledger, notes, combat, and skill-check rules modules
- security, authorization, and rules tests

Parallel boundaries:

- Discord identity and public authorization should wait until viewer filtering
  and rate-limit behavior are stable enough to protect real campaign data.
- CRDT work should wait until notes or handouts prove a concrete collaborative
  editing need.

Done when:

- Public-room access, Discord identity, equipment/ledger, notes, and broader
  rules can be added as event-backed features rather than side channels.

### Current Parallel Batch

Start with Streams A-D in parallel, with Stream E running opportunistically:

- Stream A keeps command handling split by domain and maintains the shared
  command metadata registry as new commands land.
- Stream B moves legal-action and pending-choice state into projection.
- Stream C consumes that projection through one creator view model and keeps
  `app.ts` thin.
- Stream D hardens reveal timing, viewer filtering, live activity, and two-tab
  spectator coverage.
- Stream E can continue PWA/update/smoke work where it does not touch game
  truth.

Current Character Creation completion focus:

- Projection-owned legal action data now covers term skill table choices,
  mustering benefit choices, basic training choices, and pending cascade skill
  choice options. The projection also carries homeworld law-level, trade-code,
  and background-skill choice lists, plus career-selection choices and their SRD
  qualification, survival, commission, and advancement check summaries. The
  client still keeps fallback helpers for legacy local flows, but the active
  server projection is now the preferred source for rendered choices. Aging,
  anagathics, reenlistment, survival, commission, and advancement prompts are
  also hidden when the projected legal action plan says they are not currently
  legal.
- Keep extending deterministic two-tab browser journeys for multi-term and
  multi-career travellers, especially through finalization and no early roll
  reveal. A focused deterministic browser test now covers a rolled term cascade
  choice, spectator refresh recovery, and live cascade resolution.
- Finish projection-owned polish for mustering presentation. Final-sheet/export
  display now includes UPP, readable
  characteristics, sorted skills, careers/ranks, term history, benefits,
  anagathics cost provenance, credits, equipment, and notes from the projected
  read model.
- Polish the creator UX so each step shows one clear next action and the final
  sheet is useful in real play.

Hold Streams F and G until the command/projection/filtering spine is stable
enough that tactical, Discord, and broader rules work can reuse it instead of
creating new patterns.

## Phase 0: Architecture Stabilization

Purpose: make the next feature slices cheaper and safer by tightening the
client and server seams around the current behavior.

This phase is the priority. Later character creation and tactical work should
use these seams instead of growing around them. Use the parallel workstream map
above to keep ownership clear when multiple agents work at once.

### Slice 0A: Client Kernel And Command Router

Status: partially done. A typed app command router exists with route coverage
for board, dice, door, sheet, and character creation commands. Room command
submission now lives behind `room/command-dispatch`, so request IDs, HTTP
posting, accepted-message checks, and domain dispatch wrappers are no longer
embedded directly in `app.ts`. The initiative/character rail now has its own
controller, `AppSession` exists, character creation is mounted through
`createCharacterCreationFeature`, and `app.ts` is type-checked. `app.ts` is
still a composition shell rather than a tiny boot file, but it no longer owns
the internal creator panel, wizard, publication, finalization, activity feed,
presence dock, or dice overlay graph. The rendered wizard now has a small
DOM-free `deriveCharacterCreationViewModel` foundation. Boundary checks now
prevent extracted client feature modules from importing the raw room HTTP
helpers directly; the next architecture cleanup is to expand the creator into a
signal-driven, projection-fed renderer.

Primary write ownership:

- `src/client/app/app.ts`
- new client kernel/session/router modules under `src/client/app/core/`
- `src/client/app/board/controller.ts`
- `src/client/app/room/menu/controller.ts`
- `src/client/app/character/sheet/controller.ts`
- `src/client/app/character/creation/*.ts`
- focused client tests

Tasks:

- Finish a `createAppClient()` composition root that wires DOM elements,
  room API, WebSocket, PWA install, board controller, sheet controller, dice
  overlay, and character creation.
- Keep all command submission on the existing client command router and remove
  direct room API calls from extracted feature modules as `app.ts` shrinks.
  Done for the current feature modules and guarded by `check:boundaries`.
- Split canvas and button input into a three-layer path: DOM/canvas capture,
  pure input interpretation, then command routing.
- Keep local planning state separate from authoritative state: drag previews,
  open modal state, form drafts, and pending dice animation are discardable.
- Keep shrinking `src/client/app/app.ts` into typed dependencies rather than
  letting it grow as the long-term composition and orchestration file.
- Expand the new creation view model until rendering consumes one
  projection-fed shape for phase, legal actions, pending choices, and button
  state.
- Move character creation rendering toward dependency-free signals or an
  equivalent local reactive primitive so state changes update the view without
  adding another global store or framework.
- Keep related local feature signals batched so render effects see complete
  snapshots, not half-updated selected-character, flow, or read-only state.
- Ensure each stateful client manager exposes a `dispose()` path when it owns
  listeners, effects, timers, or sockets.

Done when:

- `app.ts` is a thin boot file or composition shell.
- Character creation can be mounted, updated from projection, and disposed
  without `app.ts` owning its internal state graph.
- All game-truth commands pass through one router before hitting the room API.
- Board input, sheet actions, dice rolls, and character creation actions are
  testable without a browser.
- No authoritative state is mutated directly in the browser.

### Slice 0B: Publication And Projection Hardening

Status: partially done. Command publication already appends events, projects
state, saves checkpoints, checks stored projection parity through a named
parity helper, returns one state-bearing response, and records telemetry for
accepted/rejected/internal publication outcomes. Checkpoint decisions now return
named reasons for the current creation, interval, and character-completion
boundaries. `projectGameState` now uses an exhaustive event-handler registry
composed from domain projector modules for game, character creation, board, and
dice events.
Semantic character creation command validation now has a small helper module
for loading creation command context and centralizing status, legal-action, and
pending-decision checks.

Primary write ownership:

- `src/server/game-room/command.ts`
- `src/server/game-room/publication.ts`
- `src/server/game-room/projection.ts`
- `src/server/game-room/storage.ts`
- `src/shared/projector.ts`
- `src/shared/events.ts`
- server and projector tests

Tasks:

- Define and implement a clear projection parity policy. Avoid the bad middle
  ground where an event has already been appended but the client receives a
  rejected command because parity failed.
- Keep one state-bearing response per accepted command and one server-side
  filtering path for HTTP responses, WebSocket broadcasts, and future replay
  views.
- Extend checkpoint decisions beyond the current named boundaries:
  game creation, character creation completion, larger event-count intervals,
  map scene changes, and combat round boundaries.
- Extend publication tests so every new character creation event family
  reconstructs from checkpoint plus tail.
- Add telemetry hooks or structured test seams for projection mismatch,
  invalid command, and stale command outcomes without logging secrets.
- Keep semantic character creation command handlers in narrow domain helpers
  without bypassing the publication pipeline; add direct handler tests when new
  branches are added.

Done when:

- A new event type cannot compile without projector support.
- Stored projection and live projection are checked consistently.
- Accepted commands always return the state that can be recovered from storage.
- Viewer-safe state is never assembled in more than one ad hoc path.

### Slice 0C: Protocol Contracts And Validation

Status: partially done. Protocol fixtures exist for valid command envelopes,
malformed messages, live activity server messages, command errors, and
viewer-filtered server messages. Stable command error categories are covered by
tests. Keep expanding fixtures as new semantic character creation commands and
events replace generic transition payloads.

Primary write ownership:

- `src/shared/protocol.ts`
- `src/shared/commands.ts`
- `src/shared/events.ts`
- `src/shared/state.ts`
- protocol fixtures under colocated `__fixtures__/` directories
- protocol and validation tests

Tasks:

- Add or update JSON contract fixtures for each new semantic character creation
  command, event envelope, server response, and viewer-filtered state.
- Add negative fixtures for each new rules payload: malformed roll facts,
  illegal pending-decision choices, stale `expectedSeq`, oversize arrays or
  strings, and invalid final-sheet data.
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

### Slice 0D: Live Activity And Dice Broadcast Contract

Status: partially done. Live activity descriptors exist for tactical dice and
character creation outcomes, protocol fixtures prove bounded viewer-safe
messages, publication returns derived activity alongside state, HTTP commands
broadcast character creation activity to connected sockets, and the browser
uses the shared dice renderer for tactical and creation rolls. The next work is
to harden two-tab follow behavior and keep reveal timing centralized as the
remaining semantic branches land. Semantic aging-loss resolution and skills
completion now emit compact activity descriptors and protocol fixtures.

Primary write ownership:

- `src/shared/events.ts`
- `src/shared/protocol.ts`
- `src/server/game-room/publication.ts`
- `src/server/game-room/game-room-do.ts`
- `src/client/app/dice/overlay.ts`
- new client live-activity modules under `src/client/app/`
- server/client live activity tests

Tasks:

- Use one broadcast path for HTTP command acceptance, WebSocket room state, and
  activity messages so all connected players see compatible state and dice
  timing.
- Centralize reveal timing so roll-dependent creation results are not visible
  before the local dice animation reveal point, while preserving deterministic
  recovery after refresh.
- Add compact spectator cards for player-visible creation events:
  characteristics rolled, homeworld set, background skill chosen, career
  qualification, draft result, survival, commission, advancement, aging,
  reenlistment, mustering out, and finalization.
- Keep Discord as the durable table log target. In-app activity should be
  transient and focused on dice, outcome, and sheet preview, not chat.
- Add tests proving a command that emits a roll produces both a persisted event
  and a viewer-safe live activity message for connected players.

Done when:

- Character creation and tactical dice share one live dice path.
- Other connected players can follow a character being created without reading
  a long in-app log.
- Refresh rebuilds the truth from projection even if transient activity
  messages were missed.
- The future Discord logger can consume the same semantic event outcomes.

### Slice 0E: PWA And Release Hygiene

Status: partially done. PWA assets and service worker support exist, PWA shell
composition is extracted behind `app-shell`, docs link checking is in
`verify:quick`, quick/full verification gates exist, Cloudflare deploy
validation runs in CI, and deployed smoke covers the Worker shell, static
bundle, room commands, and WebSocket dice path. Remaining work is mostly
installed-PWA update behavior, connectivity UX, and mobile install/reload
checks.

Primary write ownership:

- `src/client/app/pwa/service-worker.ts`
- `src/client/app/pwa/install.ts`
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
- Add mobile PWA manual checks to the testing docs: install, reload, offline
  shell, update, and reconnect.

Done when:

- PWA install and update behavior is predictable on mobile.
- Docs links and deploy config fail early with actionable messages.
- Heavy checks are available without making every small docs change expensive.

### Slice 0F: Automated UX Regression And Creation Client Architecture

Status: partially done. Playwright browser smoke runs in `npm run
verify:full`; owner, failed-qualification, death/restart, seeded multi-career,
two-tab spectator follow, reveal-timing, refresh recovery, and phone-width
control paths have executable coverage. `app.ts` is now a composition shell,
and character creation is mounted through `createCharacterCreationFeature`
with dedicated controller, renderer, publication, lifecycle, command, and
follow modules. The character creation controller now owns a projection-fed
view-model signal consumed by the render controller. The remaining leverage
point is expanding that model until individual step views consume one coherent
shape for phase, legal actions, pending choices, and button state.

Primary write ownership:

- `src/client/app/app.ts`
- `src/client/app/character/creation/controller.ts`
- `src/client/app/character/creation/renderer.ts`
- `src/client/app/character/creation/command-controller.ts`
- `src/client/app/character/creation/render-controller.ts`
- `src/client/app/dice/reveal-coordinator.ts`
- browser/E2E specs or smoke scripts under `e2e/` or `scripts/`
- `docs/engineering/testing-strategy.md`
- `package.json` and CI workflow files if browser automation is added

Tasks:

- Keep the committed browser scenarios healthy and extend them when new SRD
  branches are added. Existing scenarios already cover owner finalization,
  multi-career follow, failed-qualification Drifter and Draft fallback,
  death/restart, refresh recovery, mobile controls, and failure artifacts.
- Keep the lightweight UI invariants current as new controls land. Existing
  coverage includes single-primary actions, pending-roll render suppression,
  duplicate roll-submit suppression, read-only controls, redacted dice
  activity, and stale local flow replacement after server projection advances.
- Keep `createCharacterCreationFeature` as the only character creation feature
  boundary used by `app.ts`; follow-on rendering work should hang from that
  boundary rather than adding more wizard state to the app shell.
- Keep all result deferral, spectator reveal timing, and button unblocking on
  `diceRevealCoordinator`; extend coverage when new roll-bearing creation
  actions are added instead of adding local timing code.
- Expand the rendered creation UI's single view model until step views consume
  projection-derived phase, legal actions, progress, roll facts, and completion
  gates. Local state should own only unsubmitted choices and transient UI
  controls.
- Move the creation renderer toward a signal-driven model for local UI state,
  pending command state, and reveal-coordinator output while keeping the signal
  layer private to the feature.
- Keep browser action wiring behind controller/adapters that always use the
  existing client command router. Roll-bearing commands should be impossible to
  double-submit from the same rendered control.
- Keep a smaller local command available for rapid character creation UX
  debugging as the full browser smoke grows.

Done when:

- Existing browser commands continue to reproduce owner finalization,
  death/fallback branches, and spectator follow across two browser contexts.
- Browser failures continue to leave enough artifacts to fix the bug without
  manually replaying the whole flow.
- `app.ts` stays out of character creation internals.
- Roll reveal timing stays enforced by one coordinator and tested as a
  contract.
- New creator UX work starts by adding or updating an executable scenario,
  not by relying on manual clicking as the primary regression check.

### Slice 0G: Viewer Filtering And Reveal Timing Contract

Status: partially done. Viewer-aware filtering exists as a principle and some
protocol fixtures cover viewer-filtered messages, while `diceRevealCoordinator`
defers client-visible roll results for several creation paths. State-bearing
HTTP command responses, WebSocket broadcasts, and room state refreshes now
redact pre-reveal dice `rolls` and `total` for player/spectator viewers while
preserving reveal metadata. Live activity filtering now also strips unrevealed
dice results and roll-dependent character creation activity details from
player/spectator views. Owner and referee views retain unrevealed dice details,
player/spectator views reveal them after the boundary, and the client
coordinator can schedule reveal fallback from redacted targets. Roll-bearing
semantic character creation events now carry optional `rollEventId`
correlation, and character creation live activities can expose explicit reveal
metadata while keeping the previous timestamp fallback for legacy events. The
remaining risk is narrower: roll-bearing semantic creation events now project
onto per-term `facts`, and new legal-action/client projection code consumes
those facts instead of legacy `creation.history`. The legacy history model
still exists for historical replay compatibility and older activity paths, so
future work should keep shrinking compatibility reads rather than adding new
ones.

Primary write ownership:

- `src/server/game-room/publication.ts`
- `src/server/game-room/game-room-do.ts`
- `src/server/game-room/projection.ts`
- `src/shared/protocol.ts`
- `src/shared/state.ts`
- `src/client/app/dice/reveal-coordinator.ts`
- `src/client/app/character/creation/follow.ts`
- viewer filtering, protocol, and browser follow tests

Tasks:

- Extend the viewer-filtering contract from state-bearing HTTP responses,
  WebSocket broadcasts, room state refreshes, and live activities to future
  replay/activity history.
- Extend the current owner/referee/player/spectator dice fixtures to creation
  projection details while roll-dependent details are unrevealed, revealed
  live, and recovered after refresh.
- Keep roll-dependent details hidden from spectators until the local reveal
  boundary, without weakening server-side viewer filtering or refresh recovery.
- Add regression coverage for each new semantic roll-bearing creation event so
  the persisted fact, filtered state, live activity, and reveal timing agree.
- Continue replacing transition-name-based creation activity redaction with
  explicit reveal metadata for any remaining legacy or compatibility-only
  roll-dependent activity paths.
- Keep reveal timing on `diceRevealCoordinator`; feature modules should consume
  revealed view models instead of running local timers for outcome text.

Done when:

- Every state-bearing response uses the same viewer-safe projection path.
- Owner, referee, and spectator views are fixture-backed for unrevealed,
  revealed, and refresh-recovered creation states.
- Roll-bearing creation outcomes cannot appear before reveal in the browser,
  but refresh still reconstructs the authoritative state from projection.

### Slice 0H: Architecture Consolidation

Status: in progress after the 2026-05-14 architecture review. The core
direction is still fit for purpose: server-ordered commands/events, Durable
Object room authority, replayable projections, viewer filtering, and a
dependency-light client address the product's real risks. A shared command
metadata registry now owns route/domain, seeded-dice, and stale-sequence policy
for the client router and publication path. The server command dispatcher has
started splitting into domain handlers for game, board/door/piece, and generic
dice commands, plus character creation setup, finalization, career-entry,
homeworld/background, basic-training, survival/death, promotion, lifecycle,
skills, mustering, and sheet patch commands. The remaining command dispatcher
work is consolidation and test hardening rather than another large character
creation handler split.

Primary write ownership:

- `docs/architecture/overview.md`
- `docs/architecture/patterns.md`
- `docs/engineering/coding-standards.md`
- `docs/engineering/development-standards.md`
- `docs/product/backlog.md`
- `src/server/game-room/command.ts`
- new server command-handler modules under `src/server/game-room/`
- `src/client/app/core/command-router.ts`
- `src/shared/character-creation/view-state.ts`
- character creation command, projection, and client render tests

Tasks:

- Keep the current CQRS/event-sourced architecture. Do not switch direction
  unless the product goal changes away from real-time, referee-filtered,
  recoverable tabletop play.
- Continue keeping server command handling split by domain. Game,
  board/door/piece, generic dice, character sheet, and character creation
  handlers are extracted; future command work should preserve that shape
  without weakening the ownership and rules gates. Keep
  `runCommandPublication()` as the only persistence, projection, checkpoint,
  parity, telemetry, and response path.
- Keep using the shared command metadata registry for stable facts such as
  command route/domain, seeded-dice requirement, and stale-sequence policy.
  New commands should update that registry rather than adding duplicated
  command-type lists to publication or the client command router.
- Finish the character creation read-model consolidation. Step views should
  consume one projection-fed view model for status, legal actions, pending
  choices, progress, roll facts, and button state; local UI state should hold
  only unsubmitted drafts and transient controls.
- Retire remaining legacy or generic character creation compatibility once
  replay coverage proves historical streams still project. Long-term creation
  history should be a semantic timeline derived from semantic events, not a
  generic transition log.
- Consolidate architecture documentation ownership. Keep `overview` as system
  shape, `patterns` as implementation recipes, ADRs as rationale, and this
  backlog as current work. Remove duplicated CQRS/source-boundary wording from
  standards docs when it only restates the owner architecture docs.

Done when:

- Command handling is discoverable by domain without bypassing the single
  publication pipeline.
- Adding a command updates one metadata table plus the relevant domain handler,
  not several hand-maintained lists.
- Character creation rendering is driven by a single projection-derived model
  instead of step views rediscovering legal state.
- The active docs have one owner for each architectural pattern and no stale
  repeated guidance.

## Phase 1: Server-Backed Character Creation Spine

Purpose: make character creation coherent, recoverable, and server-authoritative
before adding more UI breadth.

This phase starts from the current code: the shared SRD ruleset, status machine,
legal-action planner, homeworld/background/cascade helpers, career rules,
aging/mustering helpers, command router, protocol fixtures, projector registry,
publication parity checks, and live activity descriptors already exist. The gap
is not more client-only helper logic; it is semantic server commands/events and
server projections for each SRD fact.

Primary write ownership:

- `docs/product/character-creation-backlog.md`
- `src/shared/character-creation/`
- character creation command/event/projection code
- `src/client/app/character/creation/*.ts`
- character sheet integration tests

### Slice 1A: Semantic Commands And Events

Status: in progress. Semantic commands/events now cover characteristic rolls,
homeworld set/completion, background skill selection, cascade resolution,
career qualification, draft resolution, career term start, basic training,
survival, commission, advancement, term skill rolls, aging, reenlistment,
career reenlistment, career exit, default death confirmation, post-mustering
continuation, mustering benefits, mustering completion, and finalization. The
production client no longer constructs `AdvanceCharacterCreation`, and the
typed character-creation router excludes it. The server still decodes the
generic command for compatibility, but it is referee-only and now rejects every
current `CareerCreationEvent` payload in favor of semantic commands or explicit
fences. The server-persisted generic `SET_CHARACTERISTICS` emitted after the
sixth characteristic roll has been replaced with
`CharacterCreationCharacteristicsCompleted`. Bootstrap/demo creation,
custom-piece production paths, and local draft fallback are now off generic
`SET_CHARACTERISTICS` and `SELECT_CAREER` bridge commands. The generic command
path now returns one stable deprecated-command rejection before persistence,
while historical `CharacterCreationTransitioned` replay compatibility remains
in projection/read-model code. Custom piece creation no longer creates a
prefilled sheet, finalization no longer falls back to `UpdateCharacterSheet`,
and non-referee manual sheet edits are limited to notes. The remaining work is
continuing to move read models/live activity onto semantic event facts.

Tasks:

- Keep the current shared status machine and legal-action planner, but stop
  treating `AdvanceCharacterCreation` plus `CharacterCreationTransitioned` as
  the long-term event model.
- Keep command payloads intent-shaped. For example, commands request a career,
  a table choice, or a decision; the server derives dice, modifiers, success,
  rank, skill, or benefit facts.
- Maintain backward compatibility only for historical replay and protocol
  decode stability. New rules work should add semantic events first, then adapt
  the UI.
- Keep the completed `AdvanceCharacterCreation` migration fenced: current
  production flows use semantic commands/events, generic transition facts reject
  before persistence, shortcut sheet mutation paths are closed, and
  `CharacterCreationTransitioned` remains only for historical replay.
- Finish updating `deriveLiveActivities()` to read semantic events directly
  instead of parsing coarse transition payloads where possible. Done for
  characteristic, qualification, survival, commission, advancement, term skill,
  aging, aging-loss resolution, reenlistment, skills completion, and mustering
  rolls.
- Add protocol fixtures for every new command, event envelope, accepted
  response, rejected response, and viewer-safe live activity.

Done when:

- Each current early creation step has a semantic event with enough facts to
  replay without client-only interpretation.
- Illegal commands reject before persistence; accepted events replay to the same
  creation projection and legal-action state.
- Live activity cards can be derived from event facts without leaking full
  creation payloads.

### Slice 1B: Server Projection And Legal Actions

Tasks:

- Make projected creation state expose the legal-action plan needed by the
  client: status, pending decisions, roll requirements, failed-qualification
  options, remaining term skills, remaining mustering benefits, and completion
  gates.
- Persist pending choices such as cascade skills, basic training skill picks,
  term skill table choices, aging losses, anagathics decisions, reenlistment,
  and mustering-out benefit picks as projected state.
- Derive all visible next actions from shared rules plus server projection.
  Local client state may hold form drafts only.
- Add server validation that rejects semantic commands whose prerequisite action
  is not currently legal.
- Add checkpoint-plus-tail recovery tests for the semantic creation event
  families.
- Add client view-model tests proving the UI cannot expose an action before the
  server projection makes it legal.

Done when:

- Character creation cannot move forward through client-only state.
- Refresh recovers the same pending decisions and legal actions from storage.
- The client renders legal actions from projection instead of duplicating the
  rules flow.

### Slice 1C: Wizard Usability

Tasks:

- Add a clear creation header with current phase, current prompt, and the next
  primary action.
- Keep quick/manual character creation secondary to the step-by-step wizard.
- Show the compact one-line characteristic strip throughout the flow.
- Surface stale/rejected command recovery as a small actionable message.
- Ensure every visible roll uses the shared dice renderer.
- Show table-visible creation outcomes as compact transient cards for all
  connected viewers.

Done when:

- A new player can understand the next action on a phone-sized viewport.
- Other connected players can see important creation rolls and outcomes live.
- No creation action appears before its prerequisites are met.
- Refresh recovers the current creation state from the room projection.

### Slice 1D: Homeworld, Background Skills, And Cascade Choices

Status: mostly done in shared/client helpers, command handlers, projector
support, and final export display. The current code projects homeworld,
background skills, pending cascade skills, cascade resolution, and semantic
homeworld completion. The final plain export labels background skill sources
from law level, trade codes, or primary education. Shared action plans now also
carry the projected homeworld option list. The remaining work is to carry richer
homeworld/background provenance facts for every creation source and to keep
tightening server validation and UX around those choices.

Tasks:

- Carry background allowance, granted skills, selected skills, and unresolved
  cascades as explicit projection state for every creation source.
- Replace remaining client-derived homeworld/cascade fallback gates where they
  are no longer needed for legacy local flows.
- Keep improving provenance display for homeworld, background, and cascade
  skill sources on the final sheet as richer projection facts land.
- Extend browser refresh/follow checks for nested cascade choices and blocked
  progress.

Done when:

- Character creation cannot enter career selection until background choices are
  complete.
- Skills gained from homeworld/background are visible with provenance.
- Cascade choices survive refresh and resolve through server events.

### Slice 1E: Career Entry, Draft, And Basic Training

Status: partially done. SRD career data, qualification penalties, failed
qualification options, semantic qualification roll facts, semantic draft table
roll facts, basic training plans, career-term start projection, semantic
requested/accepted career facts, semantic basic-training completion, and client
flow helpers exist. Production career entry paths, including bootstrap/demo and
custom-piece creation, are now off generic `SELECT_CAREER`. Direct player use
of `StartCharacterCareerTerm` is blocked server-side and covered by a
regression test, so that bypass is no longer an active backlog item. The
remaining work is to tighten the browser affordances around failed
qualification and draft fallback, and to keep improving presentation around
career entry. The final plain export now includes qualification target/DM,
previous-career penalty, draft table-roll provenance, and projected
basic-training / term-skill roll provenance.

Tasks:

- Keep failed-qualification routing on the semantic qualification, Draft,
  Drifter, and career-term events; the old local draft fallback is no longer a
  production path.
- Keep the direct `StartCharacterCareerTerm` path referee-only while the normal
  player path goes through qualification, Draft, Drifter fallback, or other
  explicit legal actions.
- Keep the existing browser coverage for failed qualification, Draft roll,
  Drifter fallback, and refresh recovery green as career-entry UI changes.
- Keep tightening career-entry provenance for requested career,
  accepted/drafted career, and prior-career penalty as richer projected facts
  land. Basic-training and term-skill roll provenance are now exported from
  projected facts.

Done when:

- Failed qualification produces Drifter or Draft, matching the legacy app.
- Draft result is determined by a visible roll and persisted in the event
  stream.
- Basic training updates skills with provenance and refresh recovery.

## Phase 2: Full Character Generation

Purpose: complete the Cepheus character creation mini-game end to end.

### Slice 2A: SRD Career Term Loop

Status: in progress. The shared state machine follows the SRD order through
commission, advancement, skills, aging, reenlistment, mustering, and
finalization. SRD data alignment tests cover career tables, draft, rank rewards,
skill tables, and benefits. Semantic survival, commission, advancement, term
skill, aging, reenlistment, and mustering rolls now use server-derived dice
facts. Projected legal actions now carry term-skill table options and mustering
benefit choices, so the browser no longer has to rediscover those visible
choice lists from local rules helpers. The next priority is hardening the
remaining pending decisions, provenance, browser automation, and
multi-term/mustering UX rather than adding more client-only flow logic.

Tasks:

- Keep semantic survival pass/fail events as the pattern for the rest of the
  term loop: command intent, server-derived roll facts, projection-owned gates,
  and replay tests.
- Enforce outstanding selection gates for cascade, commission, promotion, and
  term skills before the server accepts the next command.
- Keep moving cascade follow-up decisions into projection so refresh restores
  the same next action. Term skill table choices and mustering benefit choices
  are now exposed through projected legal-action options.
- Harden the real-browser term loop through survival, commission,
  advancement, term skills, aging, reenlistment, and either death or mustering.
- Add compact term-history cards from semantic term events.

Done when:

- A normal successful term can be completed using only visible legal actions.
- Survival, commission, advancement, and term skill outcomes are replayable
  from semantic events.
- Term history matches the event stream after refresh.

### Slice 2B: Mishap And Death

Status: partial. The default Classic Traveller-style flow now routes failed
survival directly to `DECEASED` through semantic death commands/events. Generic
death and optional-mishap transition payloads are fenced or replaced by semantic
commands. The separate `MISHAP` status remains only as the placeholder for a
future optional mishap variant. Ruleset-backed optional mishap outcome tables
and full consequence events are still missing.

Tasks:

- Add SRD mishap table data and pure resolution helpers with deterministic
  injected dice.
- Add semantic mishap events for optional-variant table roll, outcome text,
  skill/equipment/stat consequences, career exit, and death when applicable.
- Keep default failed survival as an immediate deceased state.
- Keep deceased creation state from finalizing or mustering into a playable
  character.
- Add activity cards for mishap and death that reveal outcome after dice timing.

Done when:

- Failed survival produces deceased state in the default rules mode.
- Death cannot be bypassed into final playable state.
- Optional mishap outcomes replay after refresh and are visible to followers
  once that variant is enabled.

### Slice 2C: Aging, Anagathics, And Reenlistment

Status: partially done. Aging roll modifiers, aging effect selection, required
aging loss resolution, reenlistment resolution, seven-term retirement, forced
reenlistment, allowed/blocked career decisions, voluntary career exit, and
server-backed semantic aging/reenlistment facts exist. Anagathics decisions,
cost deduction, and export provenance exist; optional survival/payment edge
cases and some UI provenance still need completion.

Tasks:

- Complete optional anagathics survival/payment consequences beyond the existing
  decision, cost deduction, and projection/export provenance.
- Keep aging modifier, legal aging-loss choice, and characteristic-change
  provenance regression coverage healthy as new branches are added.
- Polish reenlistment UI/provenance for mandatory retirement after seven terms,
  forced reenlistment on 12, allowed reenlistment, blocked reenlistment, and
  voluntary career exit. The server command/event split is done; this is now
  presentation, history, and browser-regression work.

Done when:

- Aging cannot be skipped when required.
- Required aging losses are resolved through a semantic server command/event and
  reject stale, illegal, or malformed selections before persistence.
- Reenlistment outcomes are deterministic and visible.
- The player can continue, leave, retire, or be forced by the rules.

### Slice 2D: Mustering Out

Status: partially done. SRD benefit count, cash/material benefit roll
modifiers, cash limits, benefit table resolution, semantic mustering benefit
events, mustering completion events, multi-career continuation, compact
cash/material payout cards, normalized material benefit labels, and material
characteristic gains are covered. Remaining work is deeper material item
metadata, benefit-choice copy, provenance, and final sheet/export quality.

Tasks:

- Continue polishing mustering benefit choices and richer material item
  metadata where the SRD table provides it. Cash/material payout cards,
  material characteristic gains, and roll/DM/table-roll provenance are in
  place.
- Keep continuing into a new career after mustering out covered as new edge
  cases are added.
- Keep regression coverage proving remaining benefit counts are projection-fed
  and mustering cannot finish early.

Done when:

- Mustering choices and benefits are replayable from the event stream.
- Cash/material limits and modifiers match the SRD helper tests.
- Continuing into another career or finishing mustering is legal-action gated.

### Slice 2E: Final Sheet And Export

Tasks:

- Done: finalize only when gates pass; the server derives the final playable
  sheet from creation state and intent-only finalization rather than trusted
  client sheet values.
- Done: the completed-character plain export block includes UPP, readable
  characteristics, sorted skills, careers/ranks, term history, mustering
  benefits with roll/DM/table-roll provenance, material characteristic gains,
  resolved cascade choices, aging loss selections, credits, equipment, and
  notes from the projected read model.
- Extend final playable sheet coverage for deeper provenance and material
  benefit metadata as those display fields mature.
- Polish copy/layout around the completed-character UPP and export block after
  the remaining creator UX work settles.
- Add refresh-loaded room state coverage for any remaining final-sheet fields
  not covered by the current checkpoint-plus-tail read model test.

Done when:

- A character can be created from first roll through final playable sheet.
- The final sheet is valid without manual cleanup.
- Completed characters have a useful UPP/export display.

### Slice 2F: Live Following

Tasks:

- Use semantic events to emit compact follower cards for characteristics,
  homeworld/background, career qualification, draft, basic training, survival,
  mishap/death, commission, advancement, term skills, aging/anagathics,
  reenlistment, mustering, and finalization.
- Keep dice reveal timing consistent with tactical dice and avoid exposing
  resolved roll-dependent text before reveal.
- Keep the deterministic two-tab E2E journey for a two-term, multi-career
  traveller green. It now follows from before qualification through
  finalization, asserts the final Merchant/Scout terms, and verifies spectator
  recovery of the playable sheet after refresh.
- Add a pre-reveal reload/new-join regression for spectators: if a roll is
  still unrevealed, refreshed or newly opened spectator views must keep dice,
  roll-dependent outcome text, projected term skill/benefit details, and
  activity details redacted until the reveal boundary. The client reveal
  coordinator now defers an initial redacted state until the dice reveal path
  completes; keep extending this with browser coverage around projected
  character creation panels.
- Show follower state after reconnect from projection/history, with transient
  live activity only for events seen in real time.
- Keep Discord logging as a future consumer of the same semantic events rather
  than a separate creation log.

Done when:

- Other connected players can follow creation without reading a long in-app
  log.
- Missed transient activity does not affect truth after refresh.
- The future Discord logger can consume the same event facts.

## Phase 3: Tactical Table And Referee Scene Tools

Purpose: make the board useful for a real table session.

Primary write ownership:

- `src/shared/mapAssets.ts`
- `src/client/app/assets/map-*.ts`
- `src/client/app/board/los-view.ts`
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

The next batch should run like this, in this order:

1. Remove or fence the remaining generic character creation transition bridge.
   Done: generic reenlist, forced-reenlist, leave-career, blocked-reenlist,
   continue-career, mustering-benefit, no-benefit `FINISH_MUSTERING`, default
   death confirmation, optional-mishap placeholder payloads, and the
   server-persisted characteristic completion event now point at semantic
   commands/events or explicit fences. Bootstrap/demo creation and custom-piece
   production paths are now off generic `SET_CHARACTERISTICS` and
   `SELECT_CAREER`; local draft fallback is off generic commands; the typed
   client character-creation route excludes `AdvanceCharacterCreation`; and
   the server hard-deprecates the generic command path before persistence while
   preserving historical replay compatibility for old
   `CharacterCreationTransitioned` events.
2. Execute the architecture consolidation slice: keep splitting command
   handling by domain, use the shared command metadata registry for route and
   seeded-dice policy, keep `app.ts` shrinking toward a boot/composition shell,
   move character creation rendering toward one projection-fed model, and keep
   publication parity plus viewer-safe responses on the single publication
   path. Done for the server command handler split: game, board/door/piece,
   dice, sheet, and character creation commands now route through focused
   domain modules, and the character creation router derives its handled
   command type from shared command metadata.
3. Replace creation history with a semantic timeline after retiring the
   remaining legacy activity fallbacks. Roll-bearing semantic events, including
   characteristic rolls, now point at the dice event that drives reveal timing.
   Semantic creation history mapping is centralized and lifecycle mapping
   coverage now spans the active SRD semantic event set. The projection now
   also records a redaction-safe semantic `timeline` with event ids, sequence,
   timestamps, semantic event type, and optional roll correlation, while the
   shared creation read model exposes that timeline for client migration.
   Finalization notes now derive from projected terms rather than legacy
   history, and the client can recover mustering-benefit display from projected
   term benefits when legacy history is absent. Server and client cash benefit
   limit checks now use projected term benefits. Boundary checks now keep new
   client creator code from reading legacy history outside compatibility
   helpers. Per-term semantic `facts` now carry qualification, draft,
   survival, commission, advancement, rank, term skill, aging, anagathics,
   reenlistment, and mustering benefit details; legal actions, term-skill and
   mustering validators, and the client projection adapter use those facts
   instead of reconstructing the active term from legacy history. The remaining legacy
   aggregate fallbacks are explicit compatibility paths for old projections;
   the legacy `history` model remains only for historical replay compatibility
   and older activity consumers.
4. Plan and execute the viewer filtering/reveal timing slice: one filtering
   contract for HTTP, WebSocket, replay/reconnect, and activity history, with
   reveal-boundary coverage for every roll-bearing creation action.
5. Extend the automated UX regression slice before more broad creator polish:
   grow the repeat runner when new SRD branches are added, keep later-term
   two-tab spectator follow checks healthy, add mobile viewport assertions for
   new controls, and keep reveal timing coverage for every roll-bearing action.
6. Finish the remaining projection/read-model consolidation: expose compact
   follower and final-sheet view models from semantic timeline plus per-term
   facts, reduce compatibility fallbacks for older aggregate term fields, and
   reject commands that are not legal from the current projection.
7. Harden the SRD term loop in browser automation: repeated refreshes, mobile
   layouts, and multi-term continuation.
8. Keep optional mishap tables behind an explicit variant; default failed
   survival remains Classic Traveller-style death.
9. Complete anagathics survival/payment edge cases, multi-career continuation
   after mustering, final sheet/export polish, and provenance. Each slice should add
   semantic events where needed, projection replay tests, protocol fixtures,
   and compact activity descriptors.
10. Finish live following on top of semantic facts: follower cards, dice reveal
    timing, refresh recovery, and future Discord-consumable event details.
11. Run PWA/release work continuously when it does not compete with the core
   architecture path; make it a hard gate before public play.

The first product-visible milestone after this batch is: a connected player can
create several valid or deceased travellers through multiple terms, mustering
out, and finalization on a phone-sized viewport, while connected players see
dice and compact outcomes live after the reveal boundary. The server projection
remains the source of truth and refresh recovers the same legal next action.

## Do Not Start Yet

- In-app chat. Discord is the chat and narrative log.
- CRDTs for notes before a concrete collaborative editing need exists.
- React, Material UI, Amplify, DataStore, XState, Zustand, or a schema-form UI.
- Public Discord room authorization before viewer filtering and rate limits are
  tightened.
- Large Cepheus combat UI before the character creation and board scene flows
  are stable.
