# Discussion Record

This captures the rewrite decisions and source material from the initial
planning discussion so they are not lost in chat history.

## Rewrite Decision

We decided to start `cepheus-online` as a clean rewrite rather than continuing
inside `cepheus-amplify`.

The old application remains valuable as a reference for:

- rules data
- entity schemas
- player-facing character sheets
- player-facing board/map workflow
- guided character creation
- equipment and ledger behavior
- dice and initiative behavior
- flexible ruleset JSON

The old implementation should not be treated as the new app's architecture.

## AWS Amplify And DataStore

The concern was that Amplify Gen 2 does not include DataStore. The working
conclusion was:

- Amplify Gen 1 is still supported for existing applications, especially
  critical and security fixes.
- Amplify Gen 2's data story is not DataStore; it centers on AppSync-style data
  access and generated clients.
- There is no clear future-facing reason to build new product architecture on
  DataStore.
- The old whole-object optimistic DataStore model is already a poor fit for this
  app because concurrent character, board, equipment, and note edits need
  explicit conflict behavior.

The rewrite therefore targets Cloudflare Workers and Durable Objects with an
append-only event stream instead of AWS Amplify DataStore.

## Cepheus-Amplify Review Findings

The review identified these high-priority issues in the old app:

1. `src/hooks/useUnload.ts`: pending debounced saves can be lost because
   `beforeunload` does not await async DataStore flushes.
2. `amplify/backend/function/inviteUsers/src/index.js`: email lookup used the
   wrong return shape from Cognito `listUsers`; it should read `Users[0]`.
3. `amplify/backend/function/inviteUsers/src/index.js`: username generation
   treated every Cognito `adminGetUser` failure as "user not found"; only
   `UserNotFoundException` should be handled that way.
4. `src/components/game/GameDataSync.tsx`: DataStore configuration/sync could
   hang on "Sync Data..." with no visible error or recovery path.

These are legacy findings, not tasks to patch in this repo. The rewrite should
avoid the underlying failure modes.

## Conflict Model

We discussed CRDTs and OT because conflict handling is one of the old app's
largest practical problems.

The decision was:

- Use server-ordered commands and events for most game state.
- Use expected sequence numbers or explicit rejection UI for sensitive edits.
- Do not build a custom OT engine.
- Do not model the whole game as one CRDT document.
- Consider a bounded CRDT library only for document-like collaboration such as
  notes, handouts, annotations, cursors, or awareness.

## Discord

Discord should be a first-class integration:

- Discord OAuth for login and account linking.
- Internal app sessions and permissions remain the source of truth.
- Campaigns can link to Discord guilds/channels.
- Referees can invite users through Discord or app links.
- Discord can carry social context, voice, and optional bot/slash-command
  interactions.

We should not build voice or video into the first rewrite because Discord
already solves that well.

## YouTube Walkthrough

Planning also used this source:

[Introducing Cepheus Online, a tool to streamline your sci-fi RPG adventures](https://www.youtube.com/watch?v=dFKA_w-FiuI)

Signals extracted from the walkthrough:

- mobile-first PWA behavior mattered
- shared board, character sheets, dice, equipment, ledger, and notes were core
- player UX was broadly useful
- referee/GM workflows were clunkier and need stronger information architecture
- "no save button" sync was a visible product promise, but the rewrite must make
  persistence explicit and reliable
- guided character creation should expose legal next actions
- the ruleset JSON approach is worth preserving
- Discord was already the natural social layer

## Delta-V Review

We reviewed `~/Source/delta-v` and transferred only the useful patterns:

- event-sourced authority
- side-effect-free shared engine/rules code
- deterministic injected RNG
- Durable Object publication pipeline
- viewer-aware filtering
- zero-dependency reactive client helpers
- DOM helper/trusted HTML boundary
- disposal scopes
- testing and protocol contract patterns

We intentionally did not transfer Delta-V-specific renderer modules, AI,
matchmaking, rating, assets, or tactical-space rules.

## Dependency And UI Direction

The rewrite default is no runtime dependencies.

Avoid:

- Material UI
- RJSF
- Amplify/DataStore client libraries
- heavy UI state frameworks
- React Three Fiber as the default board implementation

Prefer:

- TypeScript
- plain CSS
- DOM helpers
- Canvas 2D first
- WebGL only for a specific board mode once needed
- Preact only if hand-built forms become a real maintenance burden

