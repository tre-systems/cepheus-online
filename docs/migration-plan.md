# Migration Plan

This is not a line-by-line port. The old app should remain as a reference while
the new app proves one vertical slice at a time.

## Phase 1: Foundation

- Define shared ids, commands, events, and projections.
- Build a minimal Worker and one Durable Object room.
- Add Discord OAuth proof of concept.
- Add static client shell with plain CSS.
- Add Canvas board with image background and movable pieces.

Success criteria: two browser tabs can join the same game, move a piece, roll
dice, refresh, and recover from the event stream.

## Phase 2: Character Basics

- Port entity schemas into hand-built forms.
- Add character create/edit events.
- Add equipment add/update/remove events.
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

- Port character creation machine.
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
