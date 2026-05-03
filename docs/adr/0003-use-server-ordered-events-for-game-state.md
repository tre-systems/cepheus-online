# ADR 0003: Use Server-Ordered Events for Game State

Status: Accepted

Date: 2026-05-03

## Context

The old app's conflict behavior was a core weakness. Character sheets,
equipment arrays, board pieces, and notes were vulnerable to ambiguous
last-write-wins behavior. Most game actions do not benefit from automatic
merge semantics; they need validation, permissions, ordering, and auditability.

## Decision

Model authoritative game state as commands accepted by the server and persisted
as append-only events. Live state, reconnect state, replay state, and audit
views are projections of the event stream plus checkpoints.

Clients may keep local planning state for fast UI feedback, but server state is
not mutated optimistically in the browser.

## Consequences

- Conflict handling is explicit and deterministic.
- Reconnect, replay, and audit views use the same source of truth.
- Sensitive commands can use expected sequence numbers and visible rejection UI.
- Projectors and event schema compatibility become core test targets.
