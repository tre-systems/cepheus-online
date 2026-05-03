# Conflict Model

The original DataStore app relied on optimistic whole-object writes and
DataStore subscriptions. That made conflicts difficult to reason about,
especially for nested character sheets, equipment arrays, board pieces, and
simultaneous edits.

The rewrite should make every conflict strategy explicit.

## Default: Server-Ordered Commands

Most game actions should be commands sent to the authoritative room.

Examples:

- `MovePiece`
- `SetPieceVisibility`
- `SetPieceFreedom`
- `RollDice`
- `ApplyDamage`
- `AdvanceInitiative`
- `AddEquipmentItem`
- `MarkEquipmentCarried`
- `AppendLedgerEntry`

The room validates each command against current state, rejects stale or illegal
commands, appends events, and broadcasts a new projection.

## Where CRDTs May Fit

CRDTs are useful when concurrent merging is desirable.

Good candidates:

- character notes
- campaign notes
- shared handouts with text annotations
- ephemeral cursors and awareness

Poor candidates:

- initiative order
- damage application
- tactical movement
- visibility permissions
- invites and access control

For those, deterministic server ordering is clearer and safer.

## OT

Operational Transformation is not the preferred default. It is strongest for
centralized collaborative text editing and is hard to implement correctly. This
project should not build a custom OT engine.

## No Blanket CRDT

Do not model the entire game as a CRDT document. A game is a mix of tactical
state, permissions, audit history, notes, and UI presence. Each area needs a
different conflict strategy.

## First Implementation

Start with:

- server-ordered commands/events for board and dice
- block-style server-ordered notes
- consistent `expectedSeq` on state-changing commands so stale mutations reject
  before append

Only add a CRDT dependency when the first document-like collaboration feature
needs true offline concurrent text editing.
