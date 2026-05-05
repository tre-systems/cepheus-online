# Cepheus Online Coding Agent Guide

This file is the entry point for coding agents working in this repository.
It points to the canonical owner docs rather than repeating their full content.

## First Steps

- Run `git status --short --branch` before editing. The worktree may contain
  user edits; preserve anything you did not create.
- Use `rg` and `rg --files` for codebase search.
- Read the smallest relevant owner doc before changing behavior.
- Keep edits scoped. Avoid unrelated refactors and formatting churn.
- Do not commit, push, deploy, delete data, or run destructive Cloudflare
  operations unless the user explicitly asks.

## Where To Look

| Task | Read first |
| --- | --- |
| System shape, Workers, Durable Objects | [docs/architecture/overview.md](./docs/architecture/overview.md) |
| CQRS, events, projections, client patterns | [docs/architecture/patterns.md](./docs/architecture/patterns.md) |
| Conflict and stale command handling | [docs/architecture/conflict-model.md](./docs/architecture/conflict-model.md) |
| Coding conventions | [docs/engineering/coding-standards.md](./docs/engineering/coding-standards.md) |
| Dependency and source boundary rules | [docs/engineering/development-standards.md](./docs/engineering/development-standards.md) |
| Test strategy | [docs/engineering/testing-strategy.md](./docs/engineering/testing-strategy.md) |
| Security and abuse baseline | [docs/engineering/security-baseline.md](./docs/engineering/security-baseline.md) |
| Product direction and active plan | [docs/product/vision.md](./docs/product/vision.md), [docs/product/migration-plan.md](./docs/product/migration-plan.md), [docs/product/backlog.md](./docs/product/backlog.md) |
| Delta-V transfer notes | [docs/provenance/delta-v-transfer.md](./docs/provenance/delta-v-transfer.md) |

## Project Shape

- `src/shared/` is deterministic domain code: commands, events, projectors,
  protocol validation, dice, ids, schemas, and future rules.
- `src/server/` is the Cloudflare Worker and Durable Object side: HTTP routes,
  persistence, command publication, read projections, and WebSocket handling.
- `src/client/` is the browser client source. The current playable shell lives
  in `src/client/app/` and is embedded into server assets by
  `npm run build:client`.
- `docs/` owns durable decisions and operating guidance.

## Common Commands

```bash
npm run format
npm run build:client
npm run lint
npm run check
npm test
npm run verify
```

Use the narrowest check that proves the change:

- docs only: `npm run lint` is usually enough for Markdown/JSON formatting.
- client shell changes: `npm run build:client && npm run check && npm test`.
- shared/protocol/server changes: `npm run check && npm test`.
- formatting-only changes: `npm run format`, then review the diff.
- release-level confidence: `npm run verify`.

## Coding Rules

- Keep runtime dependencies at zero unless an ADR-level reason exists.
- Keep `src/shared` side-effect-free: no DOM, network, storage, logging, or
  ambient randomness.
- Authoritative game state is projected from server-ordered events. Do not add
  CRUD-style state mutation paths.
- Commands are intent; events are facts. Persist events, then project state.
- Use `expectedSeq` on stale-sensitive mutations.
- Preserve viewer-aware filtering on every state-bearing response.
- Prefer plain functions and `createXxx()` factories. Use classes only when
  the platform requires them.
- Add or update tests for behavior changes.
- Update docs when behavior, commands, events, routes, schemas, or operating
  procedures change.

## Local Assets

`Geomorphs/` and `Counters/` are local published-product asset folders. They
must not be committed. Use them only as local inputs for development and tests
that do not copy their contents into git.

## Git Hygiene

- Preserve user changes, including untracked editor files.
- Stage only files that belong to the requested change.
- If you create or update hooks/tooling, keep them fast enough for normal local
  commits and leave exhaustive browser checks for explicit verification.
