# Data Salvage

This repository is seeded from selected parts of `cepheus-amplify`.

See [`../../data/README.md`](../../data/README.md) for the current data folder
layout and the intended normalization target.

## Copied

- `src/schemas/**` -> `src/shared/schemas/**`
- `src/types/schema.ts` -> `src/shared/types/schema.ts`
- `src/types/json.ts` -> `src/shared/types/json.ts`
- `src/data/ruleset/cepheus-engine-srd.json` -> `data/ruleset/`
- `data/rulesets/**` -> `data/rulesets/`
- `docs/project-review.md` -> `legacy/cepheus-amplify-project-review.md`
- `amplify/backend/api/cepheus/schema.graphql` ->
  `legacy/cepheus-amplify/schema.graphql`
- selected pure-domain extraction candidates ->
  `legacy/cepheus-amplify/extract-candidates/`

## Intentionally Not Copied

- Amplify generated backend and client files
- DataStore model wrappers
- React components
- Material UI theme/components
- RJSF form layer
- React Three Fiber board implementation
- build output and coverage output
- Cognito Lambda functions

## Immediate Cleanup Applied

- Removed the copied `useRulesetStore.ts` because it depended on Amplify
  DataStore and the old store factory.
- Made `pieceSchema.ts` self-contained by moving old piece visibility/freedom
  constants into the schema file.
- Rehomed schema type imports away from old path aliases.
- Reimplemented the legacy character creation status machine and first career
  rules helpers as pure shared code behind the
  `src/shared/characterCreation.ts` facade, with implementation modules under
  `src/shared/character-creation/`, without XState, React, Zustand, Amplify, or
  Material UI.
- Extracted the next layer of character creation primitives for skill
  normalization/cascade resolution, term outcome enumeration, aging effect
  selection, and mustering-out benefit resolution as pure shared helpers.
- Added pure term lifecycle helpers for term creation, reenlistment resolution,
  anagathics use/payment, aging roll modifiers, and creation/mustering gates.
- Added the first event-backed character creation persistence slice: explicit
  room commands/events now start creation, advance the creation state machine,
  and record career term starts in the server-ordered event stream.

## Next Salvage Candidates

Do not copy these blindly. Extract the domain logic and tests:

- deeper character creation rules: career event tables, mishaps, retirement
  benefit tables, promotion rank effects, and final playable sheet projection
- dice and combat calculations
- initiative ordering
- equipment ledger behavior
- board measurement and range calculations
- import/export character format

See [readiness-review.md](readiness-review.md) for the reviewed extraction
backlog, and
[`../product/backlog.md`](../product/backlog.md) for the active implementation
queue. [`../product/character-creation-backlog.md`](../product/character-creation-backlog.md)
is retained as historical character-creation review provenance.
