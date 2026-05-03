# ADR 0006: Limit CRDTs to Document-Like Collaboration

Status: Accepted

Date: 2026-05-03

## Context

CRDTs and OT came up because the old app handled conflicts poorly. They are
useful for concurrent collaborative editing, but tactical game state,
permissions, initiative, visibility, and dice outcomes should be ordered and
validated by the authoritative room.

## Decision

Do not model the whole game as a CRDT document. Do not build a custom OT engine.
Use server-ordered commands and events for most game state.

Consider a bounded CRDT dependency only for document-like collaboration such as
notes, handouts, text annotations, cursors, or awareness.

## Consequences

- Tactical and permission-sensitive state stays deterministic.
- Notes can still become truly collaborative if the product needs it.
- The first implementation can start with server-ordered note blocks and defer a
  CRDT dependency until real concurrent text editing requires it.
