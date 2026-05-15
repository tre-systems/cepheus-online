# Character Creation Backlog

This backlog is based on a deep review of the active
`~/Source/cepheus-amplify` character creation code and tests. The rewrite should
preserve the rules flow, pacing, and useful UX from that app, while continuing
to reject its React, Material UI, XState, Zustand, Amplify DataStore, and
whole-object persistence patterns.

## Reviewed Legacy Sources

The most useful legacy sources are:

- `src/machines/characterCreationMachine.ts`
- `src/machines/characterCreationMachine.test.ts`
- `src/components/character/CharacterForm.tsx`
- `src/components/character/CharacterCreationFlow.test.tsx`
- `src/components/character/creation/*.tsx`
- `src/components/character/creation/*.test.tsx`
- `src/data/character/index.ts`
- `src/data/character/useCharacterStore.ts`
- `src/data/types.ts`
- `src/schemas/characterSchema.ts`

## Product Lessons To Keep

- Character creation is a mini-game, not a form. It should be fun to step
  through the procedure and watch the character emerge from the rolls.
- Character creation is table-visible. Other connected players should be able
  to watch the important rolls and outcomes live without needing a separate
  in-app chat log.
- The UI should expose the next valid rules action, not a large form of possible
  mutations. Invalid choices should mostly be impossible to reach.
- Every roll should use the shared dice presentation so the player sees the
  result arrive with table drama.
- Homeworld, law level, trade code, primary education, and background skills are
  part of the creation story. They should not be hidden behind later character
  sheet editing.
- Pending cascade skill selections and aging characteristic choices must block
  progress until resolved.
- Career terms are the heart of the loop: qualification or draft, basic
  training, survival, commission, advancement, term skills, aging,
  reenlistment, mustering out, and finalization.
- Term history is user-facing provenance. The final sheet should show where
  skills, ranks, benefits, aging effects, and career exits came from.
- A failed qualification should clearly offer Drifter or the Draft.
- Death, mishaps, forced reenlistment, blocked reenlistment, and mandatory
  retirement are important story outcomes. The UI should present them plainly
  rather than treating them as errors.

## Patterns Not To Keep

- Do not port React component structure, Material UI dialogs, RJSF schema forms,
  Howler effects, XState machines, Zustand stores, DataStore models, or Amplify
  subscriptions.
- Do not persist mutable whole-character snapshots as the source of truth.
- Do not add a client-only character creation protocol separate from the shared
  command/event protocol.
- Do not hardcode rule tables in UI components when they belong in shared
  ruleset data or pure rules helpers.

## Rewrite Baseline

Already implemented in the rewrite:

- Server-ordered room event stream with Durable Object persistence.
- Shared command, event, and projection types for character sheet creation and
  updates.
- Event-backed character creation start, semantic characteristic rolls,
  homeworld/background/cascade events, qualification and draft roll events,
  basic training completion, career term start, survival, commission,
  advancement, term skill rolls, aging, reenlistment, mustering benefits,
  mustering completion, and finalization.
- Pure shared character creation helpers for the status machine, skill
  normalization, cascade skill handling, term outcomes, aging selection,
  benefits, term lifecycle, reenlistment, and anagathics primitives.
- Mobile-first browser shell with a character creation panel, compact
  characteristic strip, career selection, draft fallback, live shared dice,
  death state, term skills, aging/reenlistment, mustering, and early sheet
  integration.

Important remaining gaps:

- The current status machine is only a coarse lifecycle guard. It does not yet
  own the complete character creation aggregate, pending decisions, legal
  actions, roll requirements, or term sub-state.
- Too much creation behavior still lives in the client wizard/draft flow rather
  than in shared deterministic rules and server-backed events.
- Homeworld, primary education, background skills, cascade choices, career
  choices, basic training, term skill choices, aging losses, and mustering
  choices are now projected into the shared action plan or read model. The
  creator panel consumes projected term-skill and mustering options when they
  are present, including mustering career ownership. Mustering benefit counts,
  cash caps, anagathics eligibility, reenlistment outcomes, and server term-skill
  gates prefer per-term facts with explicit legacy aggregate fallbacks.
  The client projection adapter marks old aggregate mustering benefits as a
  legacy fallback instead of inventing roll provenance. Remaining work is to
  reduce legacy client fallback paths and keep polishing provenance and
  presentation.
- Projected client actions now fail closed when the accepted projection sequence
  is stale, so the browser must refresh from server state instead of submitting
  a locally valid-looking action after the room has moved on.
- Multi-term career play, mustering out, and multi-career continuation have
  deterministic browser coverage, including spectator follow through mustering
  and finalization plus final sheet reload recovery. Named E2E scripts now
  isolate reveal, death, multi-career, and finalization checks. Remaining work
  is edge-case coverage and UX polish.
- Optional mishaps remain unimplemented. Anagathics now has a server-owned
  use/skip decision before aging, but full survival-risk, cost/payment,
  provenance, and UX polish are still open.
- Character creation follow mode needs stronger two-tab automation and reveal
  timing contracts so spectators never see roll-dependent outcomes early.
- Spectator follow should show the same projected creation state as the creator
  without controls, including step changes, characteristics, choices, compact
  outcomes, and the final sheet without requiring close/reopen.

## SRD Procedure Audit Checklist

Audit date: 2026-05-06. Source artifacts checked:
`data/rulesets/srd/cepheus-engine-srd.json`,
`data/ruleset/cepheus-engine-srd.json`, and
[SRD Source](../integrations/srd-source.md). The character creation table groups
match between both local SRD JSON files; their current differences are in
equipment data, not creation procedure data.

Use this as the executable checklist for bringing the shared state machine and
legal-action planner up to the SRD procedure. Each item should have shared
projection state, semantic commands/events, legal-action coverage, and replay
tests before it is considered done.

- [x] Coarse lifecycle statuses exist for characteristics, homeworld, career
  selection, term steps, mustering out, playable, and deceased.
- [x] Roll characteristics and lock assignments with server-side semantic roll
  facts and replayed provenance.
- [~] Set homeworld data and derive background skills from law level, trade
  codes, and primary education options. Current legal action:
  `completeHomeworld`; semantic completion, pure helpers, and projected
  homeworld option lists exist. Gap: richer background-skill provenance still
  needs polish across every source.
- [~] Resolve cascade skills whenever SRD table entries use cascade markers.
  Current planner can block on `cascadeSkillResolution` and projects cascade
  choices for homeworld and term skill flows. Gap: cascade provenance and modal
  polish still need tightening across every creation source.
- [x] Qualify for a career using `careerBasics`, applying prior-career limits
  and qualification penalties, with dedicated persisted roll facts.
- [x] Resolve the Draft by rolling the `theDraft` table when eligible, then
  mark draft use on the term.
- [x] Apply basic training from `serviceSkills`: all service skills at level 0
  in the first term ever, one selected service skill for a first term in a new
  career, none when returning. Current planner can block on
  `basicTrainingSkillSelection`. Semantic completion is server-backed and the
  browser renders the choose-one service skill as explicit buttons.
- [~] Roll survival from `careerBasics`; on failure, enter mishap/death or legal
  exit handling. Current legal action: `rollSurvival`. Semantic survival
  command/event and roll facts are server-backed. Gap: mishap/death outcome
  tables remain unresolved for the optional variant.
- [~] Resolve commission and advancement from `careerBasics` and
  `ranksAndSkills`, including rank titles and bonus skills. Semantic events and
  server dice facts exist. Gap: bonus skill decisions and rank provenance still
  need UI/projection polish.
- [~] Select a term skill table and roll skills from `personalDevelopment`,
  `serviceSkills`, `specialistSkills`, or `advEducation`. Semantic table roll
  events and projected table choices exist. Gap: table-choice UX, cascade
  resolution polish, and provenance need browser-hardening.
- [~] Resolve aging from the `aging` table, including characteristic loss
  choices and anagathics modifiers. Semantic aging facts and a server-owned
  anagathics use/skip event exist. Anagathics use now rolls and stores the
  server-derived treatment cost, deducts it from credits, and projects the cost
  provenance onto the active term. Gap: anagathics survival-risk effects and
  characteristic-choice UI/projection polish are incomplete.
- [~] Roll reenlistment from `careerBasics`, handling mandatory retirement
  after seven terms, forced reenlistment on 12, success, failure, and voluntary
  exit. Current legal actions cover unresolved, forced, allowed, and blocked
  outcomes. `ResolveCharacterCreationReenlistment`,
  `ReenlistCharacterCreationCareer`, and `LeaveCharacterCreationCareer`
  persist server-derived roll facts and server-derived career decisions. Gap:
  exit provenance and UI copy are not fully wired.
- [~] Muster out using `materialBenefits` and `cashBenefits`, with benefit
  counts, cash limits, rank/Gambling modifiers, and material effects. Benefit
  roll commands/events and multi-career continuation exist. Gap: projected
  material presentation, provenance, and UI/export polish need completion.
- [~] Finalize only after at least one legal term or exit, no unresolved pending
  decisions, no unresolved death/mishap branch, and all mustering benefits are
  resolved. Current legal action: `completeCreation`. The command is
  intent-only and the server derives the final sheet. Completed summaries now
  include characteristics, sorted/deduped skills, career history, credits, and
  equipment. Gap: completed-character display polish, deeper provenance, and
  future final-field edge coverage.

## Backlog Principles

- Commands are intents. Events are facts. Projections are read models. Keep that
  separation visible in code and tests.
- The server remains authoritative for character creation state, term state, and
  completed character projections.
- The client may hold temporary UI selections, but it must not optimistically
  mutate authoritative character state.
- Manual/generated shortcuts are not canonical SRD creation. They must either
  emit the same semantic commands/events or stay outside the player-facing
  rules path. Player sheet patches are notes-only; referee corrections are the
  explicit manual escape hatch.
- Each rules action should have an explicit command and an explicit event, or a
  deliberately named aggregate command that emits explicit semantic events.
- Dice rolls should be replayable facts. Character creation events that depend
  on a roll should reference or embed the roll result deterministically.
- Player-visible creation outcomes should derive transient live activity
  messages for connected clients and, later, Discord logging.
- UI components should render from a small step view model: current status,
  current prompt, legal actions, pending selections, recent result, and sheet
  preview.
- The rules engine should stay dependency-free and unit-tested.

## Delta-V Pattern Tasks

The character creation flow should follow the same architectural discipline as
the broader [implementation plan](backlog.md):

- Keep character creation actions behind the client command router rather than
  wiring buttons directly to room API calls.
- Derive one step view model from authoritative state and local draft UI state;
  render from that model instead of scattering status checks through DOM code.
- Treat creation rolls as deterministic server facts that also drive the shared
  dice animation for connected players.
- Derive spectator activity from the same accepted semantic events as the
  creator's UI. Do not build a parallel feed that can drift from the event
  stream.
- Add JSON protocol fixtures for creation commands and events once the
  homeworld/background and term-loop payloads stabilize.
- Add projection parity tests for every new creation event family.
- Keep pending selections such as cascade skills and aging choices as explicit
  projected state, not transient browser-only flags.
- Keep the final sheet as a projection from creation events plus finalization,
  not a whole-object save that bypasses the creation history.

## State Machine And Domain Model Tasks

Goal: make character creation easier to extend and debug by making the rules
procedure explicit in shared code instead of spreading it through UI conditions.

Current assessment:

- `src/shared/character-creation/state-machine.ts` provides a useful coarse
  lifecycle: characteristics, homeworld, career selection, term stages,
  mustering out, playable, and deceased.
- That is not yet enough. The main mini-game still needs a richer aggregate
  state that knows the current term, legal next actions, pending choices, roll
  requirements, recent result, and final sheet projection.
- The client should render from a small step view model and dispatch commands;
  it should not decide which Cepheus rules transitions are valid.

Tasks:

- Define a canonical shared `CharacterCreationState` that includes:
  - sheet preview
  - current lifecycle status
  - current `CareerTermState`
  - pending decisions
  - legal next actions
  - recent roll/result presentation data
  - creation history entries
- Define explicit shared value types for:
  - `CareerTermState`
  - `PendingDecision`
  - `LegalCreationAction`
  - `RollRequirement`
  - `CreationRollResult`
  - `CreationHistoryEntry`
- Move legal-action derivation into shared pure functions. The client may
  filter actions for layout, but it must not invent or unlock them.
- Remove the remaining broad `AdvanceCharacterCreation` transition bridge now
  that semantic commands exist for the main SRD path. Keep adding semantic
  commands where behavior still matters, especially optional mishaps,
  anagathics, multi-career continuation, and final export/provenance.
- Default death confirmation now has a semantic path, optional mishap
  placeholder payloads are fenced until the optional mishap variant is
  implemented, and the server-persisted characteristic completion event is now
  semantic.
- Bootstrap/demo creation and custom-piece production paths are now off generic
  `SET_CHARACTERISTICS` and `SELECT_CAREER`. Local draft fallback and the typed
  client character-creation route are also off `AdvanceCharacterCreation`.
  Server command handling now hard-deprecates the generic command response
  before persistence while keeping protocol decode stability and historical
  replay compatibility for old `CharacterCreationTransitioned` events.
- Custom piece creation no longer creates a prefilled sheet, creation
  finalization no longer falls back to manual sheet update commands, and
  non-referee `UpdateCharacterSheet` patches can only update notes. Add any new
  import/admin tools as explicit referee-only workflows rather than player
  shortcuts.
- Make roll events first-class facts. Each roll-gated event should record the
  roll inputs, dice result, modifiers, target, success/failure, and resulting
  state transition.
- Persist pending decisions as projection state:
  - cascade skill choices
  - background skill allowances
  - basic training choose-one skills
  - commission or promotion bonus skills
  - term skill table choices
  - aging characteristic loss choices
  - mustering-out benefit choices
- Derive one client `CharacterCreationStepViewModel` from projected creation
  state plus local form draft. It should contain prompt text, compact stat
  strip, visible controls, disabled reasons, dice animation request, and sheet
  preview.
- Keep manual/generated character shortcuts outside the canonical rules state
  machine, or make them emit the same semantic creation events when they become
  production features.
- Keep expanding replay tests that rebuild the creation state and final sheet
  from events after every milestone.
- Add negative tests for illegal transitions: skipping pending decisions,
  rerolling locked characteristics, manually changing age, bypassing failed
  qualification, skipping aging, and finalizing before mustering out is legal.
- Add live activity derivation tests for table-visible transitions so other
  players can see the roll, reveal, and compact outcome at the same time as the
  creator.

Acceptance:

- A new status or rules step cannot be added without an explicit transition
  test and legal-action view-model coverage.
- Refreshing the page restores the same pending decision and next action.
- The UI has no separate state machine for Cepheus rules, only local display
  state.
- Connected viewers see creation rolls and outcome cards through the shared
  live activity path.

## Milestone 1: Make The Current Wizard Obvious

Goal: a new player can start character creation on a phone and understand the
next action without external explanation.

Tasks:

- Add a clear creation header with current phase, current prompt, and the next
  primary action.
- Keep the quick/manual character affordance secondary to the step-by-step
  wizard.
- Show the character preview beside or below the current action, with the
  compact one-line characteristic strip always visible.
- Make rejected commands and stale state recoveries visible without scaring the
  user.
- Use the shared dice renderer for every current characteristic and career roll.
- Add a deterministic browser smoke path that creates a minimum playable
  one-term character.

Acceptance:

- On a phone-sized viewport, a player can create a basic playable character
  without reading documentation.
- No creation action appears before its prerequisites are met.
- Refreshing the page recovers the current creation state from the room
  projection.

## Milestone 2: Homeworld And Background Skills

Goal: match the Cepheus homeworld/background skill procedure before career
selection.

Status: mostly done. Homeworld projection fields, semantic commands/events,
background skill helpers, cascade resolution, mobile controls, and browser
follow coverage are in place. The remaining work is polish: make every pending
background/cascade decision first-class in projection, improve provenance on
the final sheet, and keep expanding refresh/follow tests as later milestones
consume the same state.

Tasks:

- Make background allowance, selected skills, granted skills, and unresolved
  cascade choices first-class projected pending decisions for every creation
  source.
- Replace remaining client-derived homeworld/cascade progression checks with
  shared legal actions from projection.
- Polish provenance for homeworld, background, and primary education skill
  sources on the final sheet. Completed sheets now show a structured final
  summary before the plain export, and resolved term cascade choices plus aging
  loss selections are included in the plain export.
- Extend browser refresh/follow checks for nested cascade choices and blocked
  progress.

Acceptance:

- Character creation cannot enter career selection until background skill
  choices are complete.
- Skills gained from homeworld/background are visible on the sheet with their
  provenance.
- Cascade choices survive refresh and are resolved through server events.

## Milestone 3: Qualification, Draft, And Drifter

Goal: make career entry follow the rules and feel like a meaningful choice.

Status: mostly done. Qualification, failed-qualification options, Draft,
Drifter fallback, drafted terms, and visible qualification/draft dice events are
server-backed. Production career entry paths, including bootstrap/demo and
custom-piece creation, are off generic `SELECT_CAREER`; the local draft
fallback no longer replays generic career events. Browser coverage now exercises
the failed-qualification Draft and Drifter paths, so the remaining work is to
keep that coverage green and tighten copy/provenance.

Tasks:

- Keep career-entry smoke coverage current as the UI is refactored.
- Carry requested career, accepted career, drafted status, qualification
  penalty, failed-qualification options, and basic-training choice as projected
  facts.
- Keep browser coverage for failed qualification, Draft roll, Drifter fallback,
  and refresh recovery current as the UI is refactored.
- Tighten player-facing copy and provenance around qualification and draft
  outcomes.

Acceptance:

- A failed qualification produces the same player-facing options as
  cepheus-amplify: Drifter or Draft.
- The Draft result is determined by the roll and persisted in the event stream.
- Qualification state recovers correctly after refresh.

## Milestone 4: Full Career Term Loop

Goal: implement the main Cepheus term loop end to end.

Status: in progress. The main term-loop rolls are server-backed semantic facts:
survival, commission, advancement, term skills, aging, reenlistment, and
mustering benefits. Career re-enlistment, career exit, and post-mustering
continuation now have semantic commands/events instead of generic transition
payloads. The remaining work is to make pending choices, mustering completion,
provenance, and browser UX robust enough to use without manual recovery.

Tasks:

- Move choose-one basic training and term skill table choices into projected
  pending decisions.
- Polish commission eligibility, rank title, bonus skill reward, and provenance
  display.
- Polish advancement eligibility, rank title, bonus skill reward, and
  provenance display.
- Harden term skill table selection and roll resolution in browser automation,
  including the SRD rule preserved from legacy that careers without commission
  require two term skill rolls before aging/reenlistment can proceed.
- Enforce outstanding selection gates for cascade skills, commission skills,
  promotion skills, and term skills.
- Add term history cards that summarize the term in a compact, readable way.

Acceptance:

- A normal successful term can be completed using only visible legal actions.
- A failed survival path produces a deceased character in the default rules
  mode.
- Term history matches the event stream after refresh.

Next priority: harden the term-skill, aging, mustering, and multi-term browser
paths on top of the semantic server facts that now exist. Keep death as the
first hard branch after the normal pass path is authoritative, then keep
mishaps as an optional variant.

## Milestone 5: Aging, Anagathics, And Reenlistment

Goal: complete the end-of-term decisions that give character creation its risk
and pacing.

Tasks:

- Use the correct aging modifier from term count and anagathics use.
- Present aging characteristic loss choices only when required, and only for
  legal characteristics.
- Persist characteristic changes with term provenance.
- Complete optional anagathics survival check, cost/payment flow, and
  provenance on top of the server-owned use/skip decision.
- Polish reenlistment UI/provenance for retirement after seven terms, forced
  reenlistment on 12, success, failure toward mustering out, and voluntary
  career exit. The semantic command/event split is done; this is now
  presentation and regression coverage.
- Add UI copy for forced reenlistment, blocked reenlistment, retirement, and
  leave-career decisions.

Acceptance:

- Aging cannot be skipped when required.
- Reenlistment outcomes are deterministic and visible.
- The player can continue a career, leave a career, or be forced by the rules.

## Milestone 6: Mustering Out And Finalization

Goal: turn career history into a valid playable character.

Tasks:

- Continue tightening credits, starting credits, and material benefit display.
- Keep `ContinueCharacterCreationAfterMustering` as the production command for
  multi-career continuation; keep generic `CONTINUE_CAREER` fenced for replay
  compatibility only.
- Done: finalization gates prevent unresolved or illegal completion, and the
  finalized sheet is server-derived from creation events plus intent-only
  finalization.
- Done: add structured UPP/export display for completed characters, including
  characteristics, sorted/deduped skills, career history, credits, and
  equipment.
- Done: finalization E2E coverage reloads the completed sheet and verifies the
  projected final summary survives room-state recovery.

Acceptance:

- A character can be created from first roll through final playable sheet.
- Mustering out choices and benefits are replayable from the event stream.
- The final sheet is valid without manual cleanup.

## Milestone 7: Better Than Legacy Sheet Integration

Goal: make the resulting sheet easier to understand and use than
cepheus-amplify.

Tasks:

- Keep the compact stat strip and portrait-first layout for mobile.
- Add provenance views for skills, careers, benefits, and characteristic
  changes.
- Make skills tappable for action rolls with the shared dice renderer.
- Show career history as concise term cards, not a long log.
- Separate current playable sheet data from creation history while preserving
  both in projection.
- Add import/export paths only after the event-backed canonical sheet is stable.

Acceptance:

- A completed character feels ready to play immediately.
- Players can understand where the character's important skills and benefits
  came from.
- The sheet remains usable on a phone during tactical play.

## Milestone 8: Table And Referee Integration

Goal: make creation useful at the table without rebuilding chat.

Tasks:

- Log player-relevant creation events to Discord when Discord integration is
  available.
- Keep in-app feedback focused on dice, next action, and sheet preview.
- Add referee-visible review and override tools only after the player flow is
  stable.
- Make creation rolls visible to other connected players through the same
  live dice channel as tactical rolls.

Acceptance:

- Players can watch important creation rolls live.
- Discord receives the durable narrative record when integration is enabled.
- The app does not add a parallel chat or long text log.

## Test Strategy

- Keep pure helper tests close to `src/shared/character-creation/`.
- Add command/event/projector tests for every server-backed creation step.
- Add client view model tests for status-to-action rendering.
- Add stale command tests for creation actions that include expected sequence.
  Projected client actions now fail closed on stale accepted projection
  sequences; keep adding cases as new projected actions are introduced.
- Add browser smoke tests with deterministic dice inputs for:
  - full one-term path from characteristics through homeworld/background,
    survival, term skills, aging, reenlistment, and mustering
  - keep deterministic two-term, multi-career spectator coverage through
    finalization and final-sheet recovery green
  - keep failed qualification to Draft and Drifter coverage green as the flow
    changes
  - one mustering-out and finalization path
  - spectator reveal timing for later term rolls
  - spectator reload/new-join while a roll is still unrevealed, proving dice,
    outcome text, projected roll-dependent state, and activity details remain
    hidden until reveal
- Use the old `CharacterCreationFlow.test.tsx` as a scenario reference, not as a
  component structure to port.

## Suggested Next Slice

Extend the automated browser regression harness and use it to harden the
existing server-backed character creation loop across several disposable
travellers.

Reason:

- The core SRD roll facts now exist on the server, but recent defects were
  browser orchestration, button-state, reveal-timing, and mobile layout issues.
- Manual clicking is too slow to keep finding stuck states in multi-term
  creation.
- The existing real-browser smoke should grow from early reveal/follow checks
  into full one-term, failed-qualification, mustering, and mobile scenarios
  that leave screenshots, DOM state, console errors, and server responses when
  something breaks.

Expected file areas:

- `src/shared/character-creation/`
- `src/shared/commands.ts`
- `src/shared/events.ts`
- `src/shared/protocol.ts`
- `src/shared/state.ts`
- `src/server/`
- `src/client/app/character/creation/flow.ts`
- `src/client/app/character/sheet/controller.ts`
- `src/client/app/character/sheet/view.ts`
- `src/client/app/app.ts`
- `e2e/character-creation-smoke.spec.ts`
- colocated client/shared/server tests, following current repo patterns

Architecture acceptance for the next slice:

- Character creation has one shared legal-action planner.
- Characteristic and career rolls remain persisted event facts and broadcast as
  viewer-safe dice activity.
- The creator and spectators see compatible reveal timing and compact outcome
  cards, verified by repeatable browser tests.
- Refresh recovery does not depend on live activity messages having been
  received.
- A completed character sheet is derived from creation state and finalization,
  and is useful for real table play without manual cleanup.
- The creator UI keeps one clear next required action visible on mobile,
  including death/start-over, mustering, multi-career continuation, and final
  export/review paths.

## Open Design Questions

- Should dice rolls be independent events referenced by character creation
  events, or should character creation events embed their roll result directly
  while also deriving the dice activity message?
- Should early character creation begin as an authoritative server record
  immediately, or should the first few characteristic rolls remain a local draft
  until the player creates the character in the room?
- Should deceased characters be finalized into a memorial/provenance record, or
  should death force restart for the first production slice?
- How should robot, animal, and NPC character creation diverge from the player
  character procedure?
- Which creation outcomes should eventually require referee confirmation?
