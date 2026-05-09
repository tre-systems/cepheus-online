# Implementation Plan

This is the active engineering plan for Cepheus Online. It turns the backlog
into ordered implementation slices while preserving clear ownership for parallel
agents. Shipped work belongs in `git log`; this file is for active or future
work that still needs a named home.

Last reviewed: 2026-05-09.

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
2. Finish replacing coarse character creation transition events with semantic
   commands/events where generic transitions still remain. Commands remain
   intent, events record accepted facts with dice and outcome data, and any
   remaining roll-bearing generic facts are either migrated or rejected with
   stable errors.
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

## Phase 0: Architecture Stabilization

Purpose: make the next feature slices cheaper and safer by tightening the
client and server seams around the current behavior.

This phase is the priority. Later character creation and tactical work should
use these seams instead of growing around them. It can run in parallel across
Agents A, B, C, D, and E.

### Slice 0A: Client Kernel And Command Router

Status: partially done. A typed app command router exists with route coverage
for board, dice, door, sheet, and character creation commands. Room command
submission now lives behind `room-command-dispatch`, so request IDs, HTTP
posting, accepted-message checks, and domain dispatch wrappers are no longer
embedded directly in `app.ts`. `AppSession` exists and `app.ts` is type-checked,
but `app.ts` is still too large and still owns too much character-creation
feature orchestration. The next architecture cleanup is to draw a clearer
feature boundary around character creation and move the rendered wizard toward
a signal-driven, projection-fed renderer.

Primary write ownership:

- `src/client/app/app.ts`
- new client kernel/session/router modules under `src/client/app/`
- `src/client/app/board-controller.ts`
- `src/client/app/room-menu-controller.ts`
- `src/client/app/character-sheet-controller.ts`
- `src/client/app/character-creation-*.ts`
- focused client tests

Tasks:

- Finish a `createAppClient()` composition root that wires DOM elements,
  room API, WebSocket, PWA install, board controller, sheet controller, dice
  overlay, and character creation.
- Keep all command submission on the existing client command router and remove
  direct room API calls from extracted feature modules as `app.ts` shrinks.
- Split canvas and button input into a three-layer path: DOM/canvas capture,
  pure input interpretation, then command routing.
- Keep local planning state separate from authoritative state: drag previews,
  open modal state, form drafts, and pending dice animation are discardable.
- Keep shrinking `src/client/app/app.ts` into typed dependencies rather than
  letting it grow as the long-term composition and orchestration file.
- Extract character creation behind a feature boundary with explicit inputs:
  authoritative projection, transient local form state, command adapter,
  reveal coordinator, and dispose hooks.
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
boundaries. `projectGameState` now uses an exhaustive event-handler registry,
but the handlers still live in one shared projector module rather than domain
modules.

Primary write ownership:

- `src/server/game-room/command.ts`
- `src/server/game-room/publication.ts`
- `src/server/game-room/projection.ts`
- `src/server/game-room/storage.ts`
- `src/shared/projector.ts`
- `src/shared/events.ts`
- server and projector tests

Tasks:

- Split the current exhaustive event-handler registry into domain projector
  modules without changing event semantics.
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
to harden two-tab follow behavior, keep reveal timing centralized, and widen
the compact follow cards as the remaining semantic events land.

Primary write ownership:

- `src/shared/events.ts`
- `src/shared/protocol.ts`
- `src/server/game-room/publication.ts`
- `src/server/game-room/game-room-do.ts`
- `src/client/app/dice-overlay.ts`
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
- Add mobile PWA manual checks to the testing docs: install, reload, offline
  shell, update, and reconnect.

Done when:

- PWA install and update behavior is predictable on mobile.
- Docs links and deploy config fail early with actionable messages.
- Heavy checks are available without making every small docs change expensive.

### Slice 0F: Automated UX Regression And Creation Client Architecture

Status: partially done. Playwright browser smoke now runs in `npm run
verify:full`, the owner happy path now reaches mustering, finalization, sheet
open, and token creation, and a seeded multi-career browser journey covers a
Merchant term, mustering, Scout continuation, and two-tab spectator follow.
Two-tab follow coverage exists for characteristic, homeworld/background,
qualification, anagathics, aging, reenlistment, commission, advancement,
term skill rolls, mustering benefit reveal timing, and post-mustering
continuation, including mustering completion, finalization, and spectator
refresh recovery of the projected sheet. Failed qualification now has real
button-path browser coverage for both Drifter and Draft fallback recovery, and
the repeat-runner smoke creates a finalized traveller plus a fallback traveller
with failure context attachments. The shared `diceRevealCoordinator` owns
result deferral. Death/restart has deterministic browser coverage, semantic
commission/advancement/term-skill events have checkpoint-plus-tail recovery
coverage, finalization recovery now proves the server-derived sheet survives
checkpoint-plus-tail replay, and sheet-side, wizard-render, room asset
creation, character sheet, room menu, board controls, dice overlay, refresh
button, dice command, and app lifecycle wiring have been extracted from
`app.ts`. Late term-skill, reenlistment, mustering-out, finalization, and
spectator follow-card controls now have phone-width usability coverage, and
lightweight unit invariants cover single-primary actions, pending-roll render
suppression, duplicate roll-submit suppression for characteristic and
reenlistment actions, read-only spectator controls, and stale local flow
replacement after server projection advances. The remaining leverage point is
to broaden multi-term spectator recovery while continuing to extract the
character creation feature boundary from `app.ts`.

Primary write ownership:

- `src/client/app/app.ts`
- new `src/client/app/character-creation-controller.ts`
- new `src/client/app/character-creation-renderer.ts`
- new `src/client/app/character-creation-command-adapter.ts`
- `src/client/app/dice-reveal-coordinator.ts`
- browser/E2E specs or smoke scripts under `e2e/` or `scripts/`
- `docs/engineering/testing-strategy.md`
- `package.json` and CI workflow files if browser automation is added

Tasks:

- Keep the committed full one-term finalization, seeded multi-career,
  failed-qualification Drifter, failed-qualification Draft, and death/restart
  smoke tests healthy while reporting the current phase/action on failure.
- Extend the repeat runner from its current two-traveller coverage toward
  several disposable travellers, including console errors, server response
  failures, and screenshots or DOM snapshots when the flow gets stuck.
- Extend two-tab follow tests beyond the currently covered paths: repeated
  multi-term refreshes should reveal only after dice finish and recover from
  server projection on refresh.
- Extend mobile viewport checks only when new controls are introduced. Current
  early-screen, term-skill, reenlistment, mustering-out, finalization, and
  spectator follow-card controls have phone-width coverage that asserts no
  important action is hidden, disabled by accident, or overlapped.
- Add reveal-timing assertions for every roll-bearing creation action:
  no roll-dependent result text appears before the dice reveal boundary, and
  controls unblock only after the reveal has been applied. Duplicate submit
  suppression for rendered roll controls now has unit coverage.
- Extend the lightweight UI invariants as new edge cases are found; current
  coverage includes single-primary actions, pending-roll render suppression,
  duplicate characteristic and reenlistment roll suppression, read-only
  controls, and stale local flow replacement after server projection advances.
- Extract a `characterCreationController` that owns local creator state and
  exposes explicit methods for opening owner mode, opening spectator mode,
  applying authoritative state, submitting choices, and disposing listeners or
  timers.
- Make that controller the only character creation feature boundary used by
  `app.ts`; follow-on rendering work should hang from that boundary rather than
  adding more wizard state to the app shell.
- Keep all result deferral, spectator reveal timing, and button unblocking on
  `diceRevealCoordinator`; add coverage for every new roll-bearing creation
  action instead of adding local timing code.
- Make the rendered creation UI consume a single creation view model derived
  from authoritative projection plus local pending choices. Server projection
  owns phase, legal actions, progress, roll facts, and completion gates; local
  state owns only unsubmitted choices and transient UI controls.
- Move the creation renderer toward a signal-driven model for local UI state,
  pending command state, and reveal-coordinator output while keeping the signal
  layer private to the feature.
- Move browser action wiring behind a command adapter that always uses the
  existing client command router. Roll-bearing commands should be impossible to
  double-submit from the same rendered control.
- Keep a smaller local command available for rapid character creation UX
  debugging as the full browser smoke grows.

Done when:

- A single command can reproduce the owner finalization happy path plus common
  death/fallback branches in a real browser.
- A single command can verify spectator follow behavior across two browser
  contexts or tabs.
- Browser failures leave enough artifacts to fix the bug without manually
  replaying the whole flow.
- `app.ts` no longer owns character creation orchestration directly.
- Roll reveal timing is enforced by one coordinator and tested as a contract.
- New creator UX work starts by adding or updating an executable scenario,
  not by relying on manual clicking as the primary regression check.

### Slice 0G: Viewer Filtering And Reveal Timing Contract

Status: planned. Viewer-aware filtering exists as a principle and some protocol
fixtures cover viewer-filtered messages, while `diceRevealCoordinator` defers
client-visible roll results for several creation paths. The remaining risk is
that filtering, HTTP responses, WebSocket state, replay/reconnect views, and
local reveal timing can drift as new semantic events land.

Primary write ownership:

- `src/server/game-room/publication.ts`
- `src/server/game-room/game-room-do.ts`
- `src/server/game-room/projection.ts`
- `src/shared/protocol.ts`
- `src/shared/state.ts`
- `src/client/app/dice-reveal-coordinator.ts`
- `src/client/app/character-creation-follow.ts`
- viewer filtering, protocol, and browser follow tests

Tasks:

- Define one viewer-filtering contract for state-bearing HTTP responses,
  WebSocket broadcasts, replay/reconnect views, and future activity history.
- Add fixtures for owner, referee, and spectator views of creation state while
  roll-dependent details are unrevealed, revealed live, and recovered after
  refresh.
- Keep roll-dependent details hidden from spectators until the local reveal
  boundary, without weakening server-side viewer filtering or refresh recovery.
- Add regression coverage for each new semantic roll-bearing creation event so
  the persisted fact, filtered state, live activity, and reveal timing agree.
- Keep reveal timing on `diceRevealCoordinator`; feature modules should consume
  revealed view models instead of running local timers for outcome text.

Done when:

- Every state-bearing response uses the same viewer-safe projection path.
- Owner, referee, and spectator views are fixture-backed for unrevealed,
  revealed, and refresh-recovered creation states.
- Roll-bearing creation outcomes cannot appear before reveal in the browser,
  but refresh still reconstructs the authoritative state from projection.

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
- `src/client/app/character-creation-*.ts`
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
- Finish the remaining `AdvanceCharacterCreation` migration in this order:
  1. Done: replace the server-persisted generic `SET_CHARACTERISTICS` after the sixth
     stat roll with `CharacterCreationCharacteristicsCompleted`, preserving the
     semantic roll facts already emitted for individual characteristic rolls.
  2. Done: move bootstrap/demo creation and custom-piece production paths off
     generic `SET_CHARACTERISTICS` and `SELECT_CAREER`.
  3. Done: remove the local draft fallback in
     `src/client/app/character-creation-flow.ts` and exclude generic advance
     from typed client character-creation dispatch.
  4. Done: reject all current generic transition facts server-side before
     persistence, including skill rolls, cascade choices, anagathics, and
     reset.
  5. Done: replace the per-event generic command branch with a hard
     deprecated-command response while keeping protocol decode compatibility.
  6. Done: remove shortcut sheet mutation paths from custom pieces and
     character creation finalization, and fence player `UpdateCharacterSheet`
     patches to notes only.
  7. Keep `CharacterCreationTransitioned` only for historical replay while new
     production rules work emits semantic events.
- Finish updating `deriveLiveActivities()` to read semantic events directly
  instead of parsing coarse transition payloads where possible.
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

Status: mostly done in shared/client helpers, command handlers, and projector
support. The current code projects homeworld, background skills, pending
cascade skills, cascade resolution, and semantic homeworld completion. The
remaining work is to make background allowance and cascade choices fully
projection-owned across every creation source and to keep tightening server
validation and UX around those choices.

Tasks:

- Carry background allowance, granted skills, selected skills, and unresolved
  cascades as explicit projection state for every creation source.
- Replace remaining client-derived homeworld/cascade gates with projection
  legal actions.
- Improve provenance display for homeworld, background, and cascade skill
  sources on the final sheet.
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
remaining work is to carry richer basic-training choices in projection and
tighten the browser affordances around failed qualification and draft fallback.

Tasks:

- Carry choose-one basic training decisions as projected pending decisions,
  not client-only draft state.
- Remove the remaining local draft fallback in
  `src/client/app/character-creation-flow.ts` now that semantic qualification,
  draft, Drifter, and career-term events exist.
- Keep the direct `StartCharacterCareerTerm` path referee-only while the normal
  player path goes through qualification, Draft, Drifter fallback, or other
  explicit legal actions.
- Add browser coverage for failed qualification, Draft roll, Drifter fallback,
  and refresh recovery.
- Tighten career-entry provenance for requested career, accepted/drafted
  career, prior-career penalty, and basic training source skills.

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
facts. The next priority is hardening pending decisions, provenance, browser
automation, and multi-term/mustering UX rather than adding more client-only
flow logic.

Tasks:

- Keep semantic survival pass/fail events as the pattern for the rest of the
  term loop: command intent, server-derived roll facts, projection-owned gates,
  and replay tests.
- Enforce outstanding selection gates for cascade, commission, promotion, and
  term skills before the server accepts the next command.
- Move term skill table choice and cascade follow-up decisions into projection
  so refresh restores the same next action.
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
server-backed semantic aging/reenlistment facts exist. Anagathics and some UI
decisions/provenance still need completion.

Tasks:

- Use the correct aging modifier from term count and anagathics use.
- Present legal aging characteristic loss choices only when required.
- Persist characteristic changes with term provenance.
- Implement optional anagathics survival and cost/payment flow.
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
events, and mustering completion events are covered. Remaining work is
projection/UI polish for benefit choices, payouts, material item presentation,
multi-career continuation, and final sheet/export quality.

Tasks:

- Persist credits, starting credits, and material benefits.
- Support continuing into a new career after mustering out when rules allow.
- Keep remaining benefit count in projection so mustering cannot finish early.

Done when:

- Mustering choices and benefits are replayable from the event stream.
- Cash/material limits and modifiers match the SRD helper tests.
- Continuing into another career or finishing mustering is legal-action gated.

### Slice 2E: Final Sheet And Export

Tasks:

- Finalize only when gates pass: at least one term, legal exit, no outstanding
  selections, and no unresolved death/mishap branch.
- Project the final playable sheet from creation state and finalization:
  characteristics, age, skills, ranks/titles, credits, equipment/material
  benefits, career history, and notes.
- Remove the need for manual cleanup after finalization. The canonical sheet is
  derived server-side from creation events and finalization; the client does not
  submit trusted final sheet values.
- Polish the completed-character UPP display and plain export block as final
  sheet fields mature.
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
2. Finish the next architecture cleanup already underway: shrink `app.ts`,
   extract the character creation feature boundary, move rendering toward a
   signal-driven projection-fed model, split the projector registry by domain,
   and keep publication parity plus viewer-safe responses on the single
   publication path.
3. Plan and execute the viewer filtering/reveal timing slice: one filtering
   contract for HTTP, WebSocket, replay/reconnect, and activity history, with
   reveal-boundary coverage for every roll-bearing creation action.
4. Extend the automated UX regression slice before more broad creator polish:
   grow the repeat runner beyond its current finalized/fallback pair, add
   later-term two-tab spectator follow checks, mobile viewport assertions, and
   reveal timing coverage for every roll-bearing action.
6. Finish moving legal-action state into server projection: pending decisions,
   requirements, failed-qualification options, remaining term skills, remaining
   mustering benefits, and completion gates. Reject commands that are not legal
   from the current projection.
7. Harden the SRD term loop in browser automation: repeated refreshes, mobile
   layouts, and multi-term continuation.
8. Keep optional mishap tables behind an explicit variant; default failed
   survival remains Classic Traveller-style death.
9. Complete anagathics survival/cost handling, multi-career continuation after
   mustering, final sheet/export polish, and provenance. Each slice should add
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
