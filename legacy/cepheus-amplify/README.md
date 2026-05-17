# Cepheus Amplify Legacy Snapshots

This directory contains small source snapshots from `cepheus-amplify` that are
worth preserving for extraction. They are not part of the new application
runtime and should not be imported from `src`.

## Files

- `schema.graphql`: old Amplify/AppSync model shape. Use as entity provenance,
  not as the new persistence model.
- `schema-salvage/`: old entity JSON schemas and schema helper types. Use as
  form/reference provenance, not as active runtime code.
- `extract-candidates/characterCreationMachine.ts`: guided character creation
  state transitions.
- `extract-candidates/boardInteractionMachine.ts`: board interaction modes.
- `extract-candidates/character-domain.ts`: character helpers, skills,
  background skills, career/term logic, benefits, health, initiative helpers.
- `extract-candidates/combat-domain.ts`: armor, damage, carrying capacity,
  range modifiers, and combat-state modifier helpers.
- `extract-candidates/board-util.ts`: board measurement and range-band helpers.
- `extract-candidates/initiative-domain.ts`: conscious-piece filtering helper.

## Extraction Rule

Extract behavior into side-effect-free modules under `src/shared`. Do not copy
React, XState, DataStore, Zustand, Immer, Three.js, or Amplify assumptions into
the new runtime.
