# Cepheus Online

A lightweight real-time virtual tabletop for Cepheus Engine and Traveller-style
science fiction RPGs.

This is a clean rewrite of the original `cepheus-amplify` app. The new project
keeps the useful product ideas, rules data, and legacy entity-schema provenance,
but deliberately
does not carry forward AWS Amplify DataStore, Material UI, RJSF, or the old
whole-object optimistic sync model.

## Goals

- Mobile-first play for phones, tablets, desktop browsers, and projected tables.
- Fast player workflows: character sheet, dice, equipment, notes, and board.
- Strong referee tools without cluttering the player view.
- Deterministic multiplayer state through server-authoritative commands/events.
- Explicit conflict handling instead of accidental last-write-wins behavior.
- Plain CSS and browser APIs before any dependency is introduced.
- Discord login and Discord-native campaign integration.
- Rulesets as data so Cepheus variants and house rules can evolve independently.

## Current Status

This repository now has the first playable spine in place. It contains:

- design docs under `docs/`
- salvaged rules data under `data/`
- shared TypeScript commands, events, protocol validation, projections, dice,
  ruleset providers, and viewer filtering under `src/shared/`
- Cloudflare Worker routes and Durable Object game rooms under `src/server/`,
  with server-ordered command publication, event storage, checkpoints, and
  viewer-safe broadcasts
- a dependency-free browser shell served by the Worker with Canvas board play,
  local asset import, synced dice reveals, mobile-first PWA metadata, and
  editable basic character sheets
- small zero-dependency client command helpers under `src/client/`

## Architecture Direction

The active stack is:

- Cloudflare Workers for HTTP routes and static assets.
- Durable Objects for live game rooms and ordered command processing.
- Browser client with plain TypeScript, Canvas, CSS, and a tiny local reactive
  layer.

Planned storage additions remain R2 for uploaded images/archives and D1 for
user, Discord link, game index, and operational metadata.

See [docs/architecture/overview.md](docs/architecture/overview.md).

## Delta-V Influence

The rewrite borrows proven patterns from `~/Source/delta-v`: event-sourced room
state, server-authoritative command processing, deterministic injected RNG,
viewer-aware filtering, a tiny reactive UI layer, and strict source boundaries.

See [docs/provenance/delta-v-transfer.md](docs/provenance/delta-v-transfer.md)
and [docs/architecture/patterns.md](docs/architecture/patterns.md).

## Runtime Dependency Policy

Default stance: no runtime dependencies.

Dependencies can be added only when they are hard to replace correctly, have a
small surface area, and solve a problem that is not core product differentiation.
The likely first exception would be a mature CRDT library for collaborative text
or notes, not a UI framework.

## Documentation

See the [documentation index](docs/README.md).

The most important starting points are:

- [Contributing](CONTRIBUTING.md)
- [Agent guide](AGENTS.md)
- [Product vision](docs/product/vision.md)
- [Architecture](docs/architecture/overview.md)
- [Coding standards](docs/engineering/coding-standards.md)
- [Migration plan](docs/product/migration-plan.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Discussion record](docs/provenance/discussion-record.md)

## Salvaged Assets

The old app had useful domain work. This repo currently salvages:

- canonical runtime ruleset data in `data/rulesets/cepheus-engine-srd.json`
- `docs/provenance/data-salvage/**`
- `legacy/cepheus-amplify/schema-salvage/**`
- legacy review notes in `legacy/`

See [docs/provenance/data-salvage.md](docs/provenance/data-salvage.md).
See [data/README.md](data/README.md) for the current data layout.

## Rules Source

The upstream SRD source is:

[orffen/cepheus-srd](https://github.com/orffen/cepheus-srd)

See [docs/integrations/srd-source.md](docs/integrations/srd-source.md).
