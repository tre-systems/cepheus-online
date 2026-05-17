# Data Salvage

This repository is seeded from selected parts of `cepheus-amplify`.

See [`../../data/README.md`](../../data/README.md) for the current data folder
layout and the intended normalization target.

## Copied

- `src/schemas/**` -> `legacy/cepheus-amplify/schema-salvage/schemas/`
- `src/types/schema.ts` -> `legacy/cepheus-amplify/schema-salvage/types/`
- `src/types/json.ts` -> `legacy/cepheus-amplify/schema-salvage/types/`
- `src/data/ruleset/cepheus-engine-srd.json` ->
  `docs/provenance/data-salvage/cepheus-engine-srd-legacy-import.json`
- `data/rulesets/**` -> `data/rulesets/`
- historical Central Supply Catalogue parser scripts ->
  `docs/provenance/data-salvage/parse-armour.js` and
  `docs/provenance/data-salvage/parse-weapons.ts`
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
- Promoted `data/rulesets/cepheus-engine-srd.json` as the only canonical
  bundled runtime ruleset, removed the exact duplicate SRD copy, and moved
  non-runtime salvage copies/scripts under `docs/provenance/data-salvage/`.
- Moved inactive entity JSON schema salvage out of `src/shared` and into
  `legacy/cepheus-amplify/schema-salvage/`; these files are provenance only and
  are no longer part of the active shared domain or unit-test surface.

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
