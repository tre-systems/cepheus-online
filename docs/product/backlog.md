# Implementation Plan

This is the active engineering plan for Cepheus Online. It turns the backlog
into ordered implementation slices while preserving clear ownership for parallel
agents. Shipped work belongs in `git log`; this file is for active or future
work that still needs a named home.

Last reviewed: 2026-05-06.

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

## Delivery Order

The backlog is ordered so architectural leverage comes before visible breadth.
Each wave should make later work simpler, safer, or more testable.

1. Finish the architecture seams that are already partially present: thin
   client composition root, one command router, one server publication pipeline,
   one projection/filter path, and protocol fixtures.
2. Replace coarse character creation transition events with semantic
   commands/events for each rules fact. Commands remain intent, events record
   accepted facts with dice and outcome data.
3. Make the server projection the source of truth for every creation gate:
   pending choices, legal actions, term facts, final sheet fields, and refresh
   recovery.
4. Complete the SRD career term loop in order: qualification/draft/basic
   training, survival, commission, advancement, term skills, reenlistment.
5. Add the hard branches after the normal loop is authoritative: mishap/death,
   aging/anagathics, mustering out, final playable sheet, and export display.
6. Layer live following on top of semantic events so connected players see dice
   and compact outcome cards without creating another source of truth.
7. Polish the mobile PWA experience once the flow shape is stable.
8. Expand tactical board, map, LOS, referee, Discord, and rules breadth after
   the core table loop is solid.

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
for board, dice, door, sheet, and character creation commands. `app.ts` is
still large and still uses `// @ts-nocheck`, so the composition-root extraction
is not complete.

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
- Add a small `AppSession` aggregate for durable client state: authoritative
  `GameState`, room identity, viewer role, selected board/piece, open panels,
  active character creation flow, and transient request state.
- Keep all command submission on the existing client command router and remove
  direct room API calls from extracted feature modules as `app.ts` shrinks.
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

Status: partially done. Command publication already appends events, projects
state, saves checkpoints, checks stored projection parity, returns one
state-bearing response, and records telemetry for accepted/rejected/internal
publication outcomes. `projectGameState` now uses an exhaustive event-handler
registry, but the handlers still live in one shared projector module rather
than domain modules.

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
- Move checkpoint decisions into named policy helpers with Cepheus boundaries:
  game creation, character creation completion, map scene changes, combat round
  boundaries, and larger event-count intervals.
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
renders transient creation outcome cards without making an in-app log. The next
work is to derive those descriptors from more precise creation events and widen
the follow-along coverage as the remaining semantic events land.

Primary write ownership:

- `src/shared/events.ts`
- `src/shared/protocol.ts`
- `src/server/game-room/publication.ts`
- `src/server/game-room/game-room-do.ts`
- `src/client/app/dice-overlay.ts`
- new client live-activity modules under `src/client/app/`
- server/client live activity tests

Tasks:

- Define a small live activity protocol for accepted event outcomes that should
  be seen immediately: dice roll starting, dice result revealed, character
  creation milestone, character creation blocked decision, and tactical board
  update.
- Keep the event stream authoritative. Live activity messages are presentation
  companions derived from accepted events, not a second source of truth.
- Use one broadcast path for HTTP command acceptance, WebSocket room state, and
  activity messages so all connected players see compatible state and dice
  timing.
- Make character creation rolls use the same shared dice renderer and timing
  path as tactical dice rolls.
- Delay revealing roll-dependent creation results until the local dice
  animation reveal point, while preserving deterministic recovery after refresh.
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

Status: in progress. Semantic commands/events now cover homeworld completion,
basic training completion, and career term start facts. Homeworld set,
background skill, cascade resolution, and finalization already have dedicated
event families. The remaining high-value gap is replacing roll-backed generic
transitions with semantic roll facts.

Tasks:

- Keep the current shared status machine and legal-action planner, but stop
  treating `AdvanceCharacterCreation` plus `CharacterCreationTransitioned` as
  the long-term event model.
- Add semantic command/event pairs for the already-modeled first facts:
  characteristics rolled/assigned, homeworld set, background skill selected,
  cascade skill resolved, career qualification resolved, draft resolved, career
  term started, and basic training completed.
- Include complete roll facts on roll-backed events: expression, rolls, total,
  characteristic, modifier, target, success, and the SRD outcome derived from
  them.
- Keep command payloads intent-shaped. For example, commands request a career,
  a table choice, or a decision; the server derives dice, modifiers, success,
  rank, skill, or benefit facts.
- Maintain backward compatibility only as a short bridge for the current UI.
  New rules work should add semantic events first, then adapt the UI.
- Update `deriveLiveActivities()` to read semantic events directly instead of
  parsing coarse transition payloads where possible.
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

Status: mostly done in shared/client helpers and projector support. The current
code projects homeworld, background skills, pending cascade skills, cascade
resolution, and semantic homeworld completion. The remaining work is to make
background allowance and cascade choices fully projection-owned across every
creation source and to keep tightening server validation around those choices.

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

### Slice 1E: Career Entry, Draft, And Basic Training

Status: partially done. SRD career data, qualification penalties, failed
qualification options, draft table resolution, basic training plans, career
term start projection, semantic requested/accepted career facts, semantic basic
training completion, and client flow helpers exist. The remaining work is to
make server-side events record exact qualification and draft roll facts, then
carry richer basic-training choices in projection.

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

### Slice 2A: SRD Career Term Loop

Status: in progress. The survival step now has semantic server command/event
coverage with roll facts and projection support. The shared state machine
follows the SRD order through commission, advancement, skills, aging,
reenlistment, mustering, and finalization. SRD data alignment tests cover career
tables, draft, rank rewards, skill tables, and benefits. Semantic survival,
commission, advancement, and term skill rolls now use server-derived dice facts.
The next priority is wiring aging and reenlistment with the same pattern.

Tasks:

- Promote term state into server projection: career, rank, title, drafted flag,
  basic training, survival, commission, advancement, term skills, reenlistment,
  and completion.
- Keep semantic survival pass/fail events as the pattern for the rest of the
  term loop: command intent, server-derived roll facts, projection-owned gates,
  and replay tests.
- [x] Add semantic commission events, including skipped commission, roll result,
  rank/title changes, and rank bonus skills.
- [x] Add semantic advancement events, including skipped advancement, roll result,
  rank/title changes, and rank bonus skills.
- [~] Add term skill table selection and roll events for service, specialist,
  personal development, and advanced education tables.
- Enforce outstanding selection gates for cascade, commission, promotion, and
  term skills before the server accepts the next command.
- Add compact term-history cards from semantic term events.

Done when:

- A normal successful term can be completed using only visible legal actions.
- Survival, commission, advancement, and term skill outcomes are replayable
  from semantic events.
- Term history matches the event stream after refresh.

### Slice 2B: Mishap And Death

Status: skeletal. The default Classic Traveller-style flow now routes failed
survival directly to `DECEASED`. The separate `MISHAP` status remains only as
the placeholder for a future optional mishap variant. Ruleset-backed optional
mishap outcomes and their server events are still missing.

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

Status: partially done in pure helpers and legal-action planning. Aging roll
modifiers, aging effect selection, anagathics offer/payment, reenlistment
resolution, seven-term retirement, and forced reenlistment are represented in
shared code. Server-backed semantic facts and UI decisions still need to be
completed.

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

### Slice 2D: Mustering Out

Status: partially done in pure helpers. SRD benefit count, cash/material benefit
roll modifiers, cash limits, and benefit table resolution are covered by tests.
Server events and projection need to carry benefit choices and payouts as facts.

Tasks:

- Implement benefit count calculation from completed terms and rank.
- Implement cash and material benefit rolls from the ruleset.
- Apply cash limits and benefit modifiers.
- Persist credits, starting credits, and material benefits.
- Support continuing into a new career after mustering out when rules allow.
- Add semantic benefit events with career, benefit kind, roll facts, table roll,
  result text, credits, and material item where applicable.
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
- Remove the need for manual cleanup after finalization.
- Add UPP display and a plain export block for completed characters.
- Add replay tests that build the same final sheet from full event stream,
  checkpoint plus tail, and refresh-loaded room state.

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

1. Finish the remaining architecture work already underway: shrink `app.ts`,
   wire `AppSession`, split the projector registry by domain, and keep
   publication parity plus viewer-safe responses on the single publication
   path.
2. Add semantic character creation commands/events for the earliest SRD facts:
   characteristics, homeworld/background/cascade, qualification, draft, career
   term start, and basic training. Update protocol fixtures and live activity
   descriptors with each event family.
3. Move legal-action state into server projection: pending decisions, roll
   requirements, failed-qualification options, remaining term skills, remaining
   mustering benefits, and completion gates. Reject commands that are not legal
   from the current projection.
4. Complete the SRD term loop on the server projection in rules order:
   survival, commission, advancement, term skill tables, and reenlistment.
5. Add death next, because failed survival must not be hidden behind happy-path
   finalization. Keep mishap tables behind an explicit optional variant.
6. Add aging/anagathics, then mustering out, then final sheet/export. Each
   slice should add semantic events, projection replay tests, protocol fixtures,
   and compact activity descriptors.
7. Finish live following once semantic facts exist: follower cards, dice reveal
   timing, refresh recovery, and future Discord-consumable event details.
8. Run PWA/release work continuously when it does not compete with the core
   architecture path; make it a hard gate before public play.

The first product-visible milestone after this batch is: a connected player can
start character creation, roll characteristics, set homeworld/background choices
with cascade resolution, qualify or enter the draft, start a career term, apply
basic training, and recover the same legal next action after refresh. Connected
players see dice and compact outcomes live, but the server projection remains
the source of truth.

## Do Not Start Yet

- In-app chat. Discord is the chat and narrative log.
- CRDTs for notes before a concrete collaborative editing need exists.
- React, Material UI, Amplify, DataStore, XState, Zustand, or a schema-form UI.
- Public Discord room authorization before viewer filtering and rate limits are
  tightened.
- Large Cepheus combat UI before the character creation and board scene flows
  are stable.
