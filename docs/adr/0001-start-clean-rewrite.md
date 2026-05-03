# ADR 0001: Start a Clean Rewrite

Status: Accepted

Date: 2026-05-03

## Context

The existing `cepheus-amplify` application contains valuable product work:
rules data, schemas, character sheets, board UX, dice, equipment, ledger flows,
and guided character creation. It also carries architectural weight that does
not fit the next version: Amplify DataStore, Material UI, RJSF, React-heavy
client patterns, and whole-object optimistic sync.

## Decision

Build `cepheus-online` as a clean rewrite. Salvage domain data, schemas, review
findings, and UX lessons from `cepheus-amplify`, but do not port the old
implementation architecture.

## Consequences

- The rewrite can target a simpler runtime and conflict model from the start.
- Player-facing UX and rules data remain available as reference material.
- Legacy code is provenance, not the new application base.
- Useful behavior must be reimplemented behind tests instead of copied blindly.
