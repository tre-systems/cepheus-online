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
- Event-backed character creation start, coarse status transition,
  finalization, and first career term start.
- Pure shared character creation helpers for the status machine, skill
  normalization, cascade skill handling, term outcomes, aging selection,
  benefits, term lifecycle, reenlistment, and anagathics primitives.
- Mobile-first browser shell with a character creation panel, compact
  characteristic strip, first career selection, draft fallback, and early skill
  chip presentation.

Important remaining gaps:

- The browser creation flow is not yet the full Cepheus procedure.
- The current status machine is only a coarse lifecycle guard. It does not yet
  own the complete character creation aggregate, pending decisions, legal
  actions, roll requirements, or term sub-state.
- Too much creation behavior still lives in the client wizard/draft flow rather
  than in shared deterministic rules and server-backed events.
- Homeworld, primary education, and background skills are not fully
  server-backed.
- Cascade skill choices are not yet presented as first-class modal steps.
- Multi-term career play is incomplete.
- Survival, mishaps, commission, advancement, aging, anagathics, reenlistment,
  mustering out, and final playable sheet projection need end-to-end wiring.
- Character creation roll semantics need to be connected to shared dice events
  so all players can see the same creation rolls at the same time.

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
- [~] Roll characteristics and lock assignments. Current legal action:
  `setCharacteristics`. Gap: no first-class characteristic roll facts,
  assignment choices, or replayed roll provenance.
- [~] Set homeworld data and derive background skills from law level, trade
  codes, and primary education options. Current legal action:
  `completeHomeworld`; pure helpers exist. Gap: no server-backed homeworld
  projection, background selection commands/events, or refresh-safe pending
  cascade flow.
- [~] Resolve cascade skills whenever SRD table entries use cascade markers.
  Current planner can block on `cascadeSkillResolution`. Gap: cascade choices
  are not yet a first-class server-backed modal step through all creation
  sources.
- [~] Qualify for a career using `careerBasics`, applying prior-career limits
  and qualification penalties. Current legal action: `selectCareer`. Gap:
  qualification success/failure is not a persisted roll fact and failed
  qualification does not yet expose only Drifter or the Draft from shared state.
- [ ] Resolve the Draft by rolling the `theDraft` table exactly once when
  eligible, then mark draft use on the term.
- [~] Apply basic training from `serviceSkills`: all service skills at level 0
  in the first term ever, one selected service skill for a first term in a new
  career, none when returning. Current planner can block on
  `basicTrainingSkillSelection`. Gap: not yet end-to-end server-backed.
- [~] Roll survival from `careerBasics`; on failure, enter mishap/death or legal
  exit handling. Current legal action: `rollSurvival`. Gap: mishap/death
  outcome tables and roll facts are not fully projected.
- [~] Resolve commission and advancement from `careerBasics` and
  `ranksAndSkills`, including rank titles and bonus skills. Current legal
  actions: `rollCommission`, `skipCommission`, `rollAdvancement`,
  `skipAdvancement`. Gap: bonus skill decisions and rank provenance are not yet
  complete.
- [~] Select a term skill table and roll skills from `personalDevelopment`,
  `serviceSkills`, `specialistSkills`, or `advEducation`. Current planner can
  block on `skillTrainingSelection`. Gap: table choice, roll result, and skill
  provenance are not yet persisted end to end.
- [~] Resolve aging from the `aging` table, including characteristic loss
  choices and anagathics modifiers. Current legal action: `resolveAging`; aging
  loss can block progress. Gap: anagathics and characteristic-choice events are
  incomplete.
- [~] Roll reenlistment from `careerBasics`, handling mandatory retirement
  after seven terms, forced reenlistment on 12, success, failure, and voluntary
  exit. Current legal actions cover unresolved, forced, allowed, and blocked
  outcomes. Gap: roll facts and exit provenance are not fully wired.
- [~] Muster out using `materialBenefits` and `cashBenefits`, with benefit
  counts, cash limits, rank/Gambling modifiers, and material effects. Current
  planner can block on remaining benefits. Gap: benefit roll commands/events
  and final projected credits/materials are incomplete.
- [~] Finalize only after at least one legal term or exit, no unresolved pending
  decisions, no unresolved death/mishap branch, and all mustering benefits are
  resolved. Current legal action: `completeCreation`. Gap: final sheet
  projection and protocol fixtures still need completion.

## Backlog Principles

- Commands are intents. Events are facts. Projections are read models. Keep that
  separation visible in code and tests.
- The server remains authoritative for character creation state, term state, and
  completed character projections.
- The client may hold temporary UI selections, but it must not optimistically
  mutate authoritative character state.
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
- Replace broad `AdvanceCharacterCreation` transitions with semantic commands
  where behavior matters: roll characteristics, set homeworld, select
  background skill, qualify, draft, apply basic training, survive, resolve
  mishap, commission, advance, roll term skill, age, reenlist, muster out, and
  finalize.
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
- Add replay tests that rebuild the creation state and final sheet from events
  after every milestone.
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

Tasks:

- Extend the shared character creation projection with:
  - `homeWorld.name`
  - `homeWorld.lawLevel`
  - `homeWorld.tradeCodes`
  - `backgroundSkills`
  - `pendingCascadeSkills`
- Add commands and events for setting homeworld data and resolving background
  skill selections.
- Port or confirm pure helpers for:
  - primary education skill selection
  - background skills from law level and trade codes
  - total background skill allowance, including Education modifier
  - cascade skill detection and resolution
- Add UI controls for law level, trade code, primary education, and background
  skill selection using the black, green, and white mobile visual language.
- Add a cascade skill modal that supports nested cascade skills and blocks
  progress until resolved.
- Add tests for all helper behavior, command validation, projection updates, and
  browser view model transitions.

Acceptance:

- Character creation cannot enter career selection until background skill
  choices are complete.
- Skills gained from homeworld/background are visible on the sheet with their
  provenance.
- Cascade choices survive refresh and are resolved through server events.

## Milestone 3: Qualification, Draft, And Drifter

Goal: make career entry follow the rules and feel like a meaningful choice.

Tasks:

- Move the current partial career entry UI onto explicit server-backed commands
  and events.
- Prevent normal qualification into careers the character has already left,
  except for Drifter behavior allowed by the rules.
- Apply the previous-career qualification penalty.
- On failed qualification, set `failedToQualify` and expose only Drifter or the
  Draft.
- Implement the Draft as a 1d6 table roll from the ruleset, not as a direct
  selection.
- Mark drafted terms and clear draft eligibility after draft use.
- Emit visible dice events for qualification and draft rolls.

Acceptance:

- A failed qualification produces the same player-facing options as
  cepheus-amplify: Drifter or Draft.
- The Draft result is determined by the roll and persisted in the event stream.
- Qualification state recovers correctly after refresh.

## Milestone 4: Full Career Term Loop

Goal: implement the main Cepheus term loop end to end.

Tasks:

- Promote the current term model into a server-backed projection with:
  - career
  - rank
  - rank title
  - drafted flag
  - completed basic training
  - survival result
  - commission result
  - advancement result
  - skills and training rolls
  - mishap outcome
  - term completion
- Implement basic training:
  - first term ever grants all service skills at level 0
  - later first term in a new career grants one selected service skill at level
    0
  - returning to the same career does not repeat basic training
- Implement survival rolls and survival failure outcomes.
- Implement mishap and death handling from the ruleset.
- Implement commission eligibility, commission roll, commission rank, rank
  title, and any commission skill reward.
- Implement advancement eligibility, advancement roll, promotion rank, rank
  title, and any promotion skill reward.
- Implement term skill table selection and roll resolution, including the SRD
  rule preserved from legacy that careers without commission require two term
  skill rolls before aging/reenlistment can proceed.
- Enforce outstanding selection gates for cascade skills, commission skills,
  promotion skills, and term skills.
- Add term history cards that summarize the term in a compact, readable way.

Acceptance:

- A normal successful term can be completed using only visible legal actions.
- A failed survival path produces a valid mishap or death outcome.
- Term history matches the event stream after refresh.

## Milestone 5: Aging, Anagathics, And Reenlistment

Goal: complete the end-of-term decisions that give character creation its risk
and pacing.

Tasks:

- Wire the pure aging helpers into server-backed commands and events.
- Use the correct aging modifier from term count and anagathics use.
- Present aging characteristic loss choices only when required, and only for
  legal characteristics.
- Persist characteristic changes with term provenance.
- Implement optional anagathics use, survival check, and cost/payment flow.
- Implement reenlistment:
  - retirement required after seven terms
  - roll of 12 forces reenlistment
  - success allows reenlistment
  - failure blocks reenlistment and moves toward mustering out
- Add UI copy for forced reenlistment, blocked reenlistment, retirement, and
  leave-career decisions.

Acceptance:

- Aging cannot be skipped when required.
- Reenlistment outcomes are deterministic and visible.
- The player can continue a career, leave a career, or be forced by the rules.

## Milestone 6: Mustering Out And Finalization

Goal: turn career history into a valid playable character.

Tasks:

- Implement benefit count calculation from completed terms and rank.
- Implement cash and material benefit rolls from the ruleset.
- Apply cash benefit limits.
- Apply cash benefit modifiers for retirement and Gambling.
- Apply material benefit modifiers for high rank.
- Persist credits, starting credits, and material benefits.
- Support continuing into a new career after mustering out when rules allow.
- Implement finalization gates:
  - at least one term
  - current term complete or character has legally exited
  - no outstanding selections
  - not in an unresolved death or mishap branch
- Project the finalized sheet from creation state, preserving creation history.
- Add UPP/export display for completed characters.

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
- Add browser smoke tests with deterministic dice inputs for:
  - characteristics through homeworld/background
  - failed qualification to Draft
  - one successful career term
  - one mustering-out and finalization path
- Use the old `CharacterCreationFlow.test.tsx` as a scenario reference, not as a
  component structure to port.

## Suggested Next Slice

Build the state-machine and live-roll spine next, then Milestone 2: homeworld
and background skills with cascade resolution.

Reason:

- It removes the biggest source of future bugs: rules progress split between
  client wizard state and server projection state.
- It gives every later creation step a consistent place to define legal
  actions, pending decisions, roll facts, and spectator activity.
- It is the next missing Cepheus procedure step before career selection.
- It matches the screenshots and legacy UX the user already likes.
- It exercises the right architecture: command validation, semantic events,
  projection recovery, pending selection state, live dice, and focused mobile
  UI.
- It is smaller and safer than trying to implement the full multi-term loop in
  one slice.

Expected file areas:

- `src/shared/character-creation/`
- `src/shared/commands.ts`
- `src/shared/events.ts`
- `src/shared/protocol.ts`
- `src/shared/state.ts`
- `src/server/`
- `src/client/app/character-creation-flow.ts`
- `src/client/app/character-sheet.ts`
- `src/client/app/app.ts`
- `test/` or colocated client/shared tests, following current repo patterns

Architecture acceptance for the next slice:

- Character creation has one shared legal-action planner.
- Characteristic and career rolls are persisted event facts and broadcast as
  viewer-safe dice activity.
- The creator and spectators see compatible reveal timing and compact outcome
  cards.
- Refresh recovery does not depend on live activity messages having been
  received.

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
