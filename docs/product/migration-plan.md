# Migration Plan

This is not a line-by-line port. The old app should remain as a reference while
the new app proves one vertical slice at a time.

## Near-Term Queue

The current implementation queue should keep tightening the playable vertical
slice before widening into rules depth:

1. Complete the `app.ts` extraction so client modules stay small, testable, and
   separated by feature.
2. Build the guided character creation backlog, starting with homeworld,
   background skills, and cascade selection before widening into the full career
   term loop.
3. Expand board and map support with asset selection, placement workflows, and
   line-of-sight/visibility behavior that remains referee-controlled.
4. Improve dice presentation so rolls are easier to read at the table while the
   authoritative event stream stays unchanged.
5. Harden CQRS and event-sourcing edges: stale command handling, projection
   recovery, viewer-aware filtering, and focused regression tests.
6. Finish the Discord/session path needed for invites, identity continuity, and
   room access.
7. Add deployment smoke coverage that proves the hosted Worker, Durable Object,
   static client, and WebSocket path still form one working slice.

## Phase 1: Foundation

- Define shared ids, commands, events, and projections. Done for the playable
  room spine.
- Build a minimal Worker and one Durable Object room. Done for HTTP commands,
  state recovery, and WebSocket dice broadcasts.
- Add Discord OAuth proof of concept.
- Add static client shell with plain CSS. Done for the mobile-first PWA shell.
- Extract the static client source out of `src/server`. Done; source now lives
  in `src/client/app` and is embedded by `npm run build:client`.
- Add Canvas board with image background and movable pieces. Done for local
  board images, piece images/counters, camera controls, visibility, and movement
  freedom.

Success criteria: two browser tabs can join the same game, move a piece, roll
dice, refresh, and recover from the event stream.

## Phase 2: Character Basics

- Port entity schemas into hand-built forms. In progress with the dependency-free
  character sheet tabs.
- Add character create/edit events. Basic create/edit events are in place for
  notes, age, characteristics, skills, credits, and simple equipment.
- Add equipment add/update/remove events. Not started as item-level events;
  current UI replaces the simple equipment list through `UpdateCharacterSheet`.
- Add ledger append/export.
- Add notes as server-ordered blocks.

Success criteria: player-facing character sheet matches the useful parts of the
old UX without MUI or RJSF.

## Phase 3: Referee Tools

- Add prep/admin mode.
- Add visibility controls for pieces and characters.
- Add board management.
- Add player/spectator permissions.
- Add invite flow through Discord and direct links.

Success criteria: referee can run a simple scene without leaving the app.

## Phase 4: Cepheus Rules

- Port the character creation procedure through the active
  [character creation backlog](character-creation-backlog.md), keeping the
  server-command, event, and projection boundaries explicit.
- Port dice, skill, combat, damage, initiative, and equipment calculations.
- Add tests before or during each extracted behavior.

Success criteria: character creation and tactical combat match the old app's
expected behavior.

## Phase 5: Collaboration

- Decide whether notes need a CRDT dependency.
- Add presence/awareness.
- Add conflict and rejection UI.
- Add replay/audit views from the event stream.

Success criteria: conflict behavior is visible, deterministic, and testable.
