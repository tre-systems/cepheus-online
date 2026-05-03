# Product Vision

This document captures the useful product signal from the original Cepheus
Online walkthrough video and the current rewrite discussion.

## What The Product Is

Cepheus Online is a focused tabletop aid for running Cepheus Engine and
Traveller-style campaigns. It should not become a generic virtual tabletop with
every possible feature. The strength of the original app was that most of the
screen was the thing being played: character sheets, a shared board, dice, and
referee-controlled visibility.

The product must work for:

- fully online play with Discord voice
- in-person play where everyone uses phones
- hybrid play with a projected board and phone controls
- solo prep and character generation
- convention or pickup games where players join by invite link

## Player Experience

Players should be able to:

- join a game from a link or Discord invite
- create a character through legal guided steps
- see their own character sheet quickly on a phone
- roll checks and see results shared immediately
- manage equipment, carried weight, credits, and ledger entries
- write notes without hunting for save buttons
- move permitted board pieces
- point at things on the board
- understand when it is their turn in combat

The player interface should stay compact and thumb-friendly.

## Referee Experience

The old app was stronger for players than for the referee. The rewrite should
separate live play from prep/admin work.

Referees need:

- clear game setup and invite flow
- Discord user invite/linking
- player, spectator, and NPC permission controls
- quick character visibility and active-state controls
- fast board creation from image, URL, or dropped asset
- piece visibility states: hidden, preview, visible
- piece freedom states: locked, owner/referee movable, shared player movable
- initiative and turn controls
- damage/combat tools that remain overrideable
- compact campaign notes and scene prep

The referee view can be denser than the player view, but should not leak
unrelated admin controls into the live board.

## What To Preserve From The Original App

- Mobile-first layout.
- Character rail plus main board.
- Board as a general shared surface, not only a tactical map.
- Guided character creation that exposes only valid next actions.
- Shared dice rolls with visible results.
- Equipment and ledger workflow.
- Image-backed boards and pieces.
- Spectator mode.
- Flexible ruleset JSON.
- Discord as the social layer.

## What To Improve

- Conflict handling must be explicit.
- Referee workflows need a stronger information architecture.
- The app should avoid heavy UI and sync libraries.
- Game state should be recoverable and replayable from events.
- Notes and long-form collaboration should use a bounded CRDT or ordered block
  model rather than whole-object saves.
