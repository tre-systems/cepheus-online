# Readiness Review

Date: 2026-05-03

This review compares `cepheus-online` with local `cepheus-amplify`, local
`delta-v`, and upstream `orffen/cepheus-srd`.

## Verdict

We have a clear direction and a strong foundation. The repo is organized around
the right decisions: clean rewrite, Cloudflare Workers and Durable Objects,
server-ordered events, a dependency-light browser client, Discord identity, and
bounded CRDT usage only where document-like collaboration needs it.

We have not extracted all useful implementation behavior yet. That is expected:
the old app's valuable behavior is tangled with React, XState, DataStore,
Zustand, Immer, Three.js, and Amplify model types. The right next step is to
extract domain behavior into pure `src/shared` modules as each vertical slice is
implemented.

## Cepheus Online Current State

Already in place:

- ADRs for the major architectural choices.
- Product, architecture, engineering, integration, and provenance doc folders.
- Salvaged rules JSON and legacy ruleset working files.
- Salvaged JSON schemas and schema type helpers.
- Initial shared ids, commands, events, state, and projector.
- Zero-dependency reactive and DOM helpers transferred from Delta-V.
- Deterministic PRNG and generic shared utilities.
- No runtime dependencies.

## Delta-V Comparison

Captured well:

- Event-sourced authority.
- Durable Object room ownership.
- Side-effect-free shared code.
- Deterministic injected RNG.
- Viewer-aware filtering.
- Full-state authoritative messages.
- Dependency-light DOM/Canvas client.
- Local reactive primitives and disposal scopes.
- Testing strategy: co-located tests, protocol fixtures, property tests, and
  replay/projection parity.

Still to implement from the pattern, not copy:

- Worker entry point and `GameRoom` Durable Object.
- Chunked event storage and checkpoints.
- Publication pipeline.
- Protocol validators and state-bearing messages.
- Viewer-specific projections.
- Browser composition root, command router, local planning state, and Canvas
  renderer.
- CI and verification scripts.

## Cepheus-Amplify Salvage

Already salvaged:

- Entity JSON schemas.
- Shared schema types.
- Ruleset JSON and rule working data.
- Project review findings.
- High-level UX lessons from the walkthrough.

Newly preserved as legacy snapshots:

- Old Amplify GraphQL schema.
- Character creation state machine.
- Board interaction state machine.
- Character domain helpers.
- Combat helpers.
- Board measurement helpers.
- Initiative helper.

Still worth extracting into pure modules:

- Character creation rules and valid next actions.
- Background skills, cascade skills, terms, careers, benefits, aging, survival,
  commission, advancement, reenlistment, mustering out.
- Dice expression/result model, without 3D dice physics or Howler.
- Combat damage, armor, range bands, modifiers, fatigue, dodge, aim, and
  reactions.
- Equipment totals, carried weight, credits, buy/sell/ledger behavior.
- Board measurement, range bands, piece visibility, and piece freedom.
- Presence/awareness semantics.
- Import/export and old migration scripts, only if legacy data migration becomes
  a product requirement.

Not worth carrying forward:

- Amplify generated models, GraphQL operations, DataStore stores, and generated
  Amplify Studio forms.
- Material UI and RJSF form layer.
- React Three Fiber board implementation.
- Cognito-specific invite Lambda implementation, except as a warning from the
  review findings.
- Old dependency/linting/TypeScript migration docs, except as historical
  context.

## SRD Source Review

Current upstream source is `orffen/cepheus-srd` on the `mdbook` branch. The
source tree is Markdown plus small JavaScript tools, organized into Book 1,
Book 2, Book 3, Vehicle Design System, and Tools.

Important import targets:

- `src/book1/character-creation.md`
- `src/book1/skills.md`
- `src/book1/equipment.md`
- `src/book1/personal-combat.md`
- `src/book2/ship-design-and-construction.md`
- `src/book2/space-combat.md`
- `src/book3/worlds.md`
- `src/book3/environments-and-hazards.md`
- `src/vds/**`
- `src/tools/**`

The latest upstream release observed during this review is `v9.1`, published
2025-07-06. The release note is minor: it fixes the sector generator map button
re-enabling after sector edits.

We should build a pinned importer rather than manually copying SRD text into the
runtime. Preserve attribution, Open Game Content notices, product identity
language, and source-code license notes.

## Concrete Missing Pieces

These are not blockers for starting, but they are the next real work:

1. Tooling: choose formatter/linter/test runner and add CI.
2. Cloudflare skeleton: Worker, Durable Object class, local Wrangler config,
   and storage interfaces.
3. Protocol: runtime validation for client/server messages.
4. Event storage: chunked event stream, checkpoints, and projection parity.
5. Viewer filtering: player/referee/spectator projections before any broadcast.
6. Rules extraction: start with dice, range bands, combat damage, and character
   creation state transitions.
7. Ruleset canonicalization: resolve the two similar `cepheus-engine-srd.json`
   files and define a single canonical ruleset output.
8. SRD importer: pin upstream version/commit and turn Markdown/table content
   into typed data where needed.
9. UI vertical slice: browser shell, create/join game, Canvas board, move piece,
   roll dice, refresh/reconnect.
10. Discord proof of concept: OAuth callback, internal session, user identity,
    and campaign invite link.

## Assessment

This is an excellent start. The architecture is coherent, the docs now explain
why each major decision exists, the dependency stance is clear, and the repo has
enough source material to begin a disciplined vertical slice.

The important caution is sequencing: do not start with the whole character
sheet. Start with the room/event/projection spine, then add board movement and
dice. Once that spine works, the old app's character creation and combat logic
can be extracted safely into the shared rules layer.

