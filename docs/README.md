# Documentation

This directory is the planning and engineering record for the rewrite. The docs
are intentionally split by ownership so future changes have one obvious place
to land.

## Start Here

- [Product vision](product-vision.md): what the application is trying to be.
- [Architecture](architecture.md): target stack, runtime model, and source
  boundaries.
- [Migration plan](migration-plan.md): staged implementation path from skeleton
  to playable vertical slice.

## Core Design

- [Conflict model](conflict-model.md): server-ordered events, CRDT boundaries,
  and why whole-game CRDT/OT is not the default.
- [Discord integration](discord.md): OAuth, sessions, bot integration, guild
  role mapping, and voice/video boundaries.
- [Security baseline](security-baseline.md): authority, hidden data, access,
  rate limits, and retention concerns.

## Engineering Standards

- [Patterns](patterns.md): event stream, publication pipeline, client state,
  protocol, DOM, and reactive patterns.
- [Development standards](development-standards.md): dependency policy, source
  boundaries, naming, validation, and test conventions.
- [Testing strategy](testing-strategy.md): unit, protocol, Durable Object, and
  browser test plan.

## Source Material And Provenance

- [Discussion record](discussion-record.md): durable record of the initial
  planning conversation, including AWS/DataStore, review findings, video
  signals, Discord, CRDTs, and dependency stance.
- [Delta-V transfer](delta-v-transfer.md): what was reviewed and transferred
  from `~/Source/delta-v`.
- [Data salvage](data-salvage.md): what was copied from `cepheus-amplify` and
  what was intentionally left behind.
- [SRD source](srd-source.md): upstream SRD repository, license notes, and
  import strategy.
- [Decisions](decisions.md): compact list of current and open decisions.

## Historical Material

Legacy review notes live under [`../legacy`](../legacy). Treat those as
historical source material. Promote any still-relevant item into the active docs
or issue tracker before implementing it.
