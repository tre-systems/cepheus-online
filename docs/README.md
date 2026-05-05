# Documentation

This directory is the planning and engineering record for the rewrite. Docs are
grouped by purpose so each future change has an obvious home.

## Start Here

- [Product vision](product/vision.md): what the application is trying to be.
- [Architecture overview](architecture/overview.md): target stack, runtime
  model, and source boundaries.
- [Migration plan](product/migration-plan.md): staged implementation path from
  skeleton to playable vertical slice.
- [Implementation backlog](product/backlog.md): active parallel work streams
  and tasks.
- [Character creation backlog](product/character-creation-backlog.md): active
  task queue for the guided Cepheus character creation flow.
- [Architecture Decision Records](adr/README.md): accepted technical decisions
  and open decision points.

## Product

- [Product vision](product/vision.md)
- [Migration plan](product/migration-plan.md)
- [Implementation backlog](product/backlog.md)
- [Character creation backlog](product/character-creation-backlog.md)

## Architecture

- [Architecture overview](architecture/overview.md)
- [Conflict model](architecture/conflict-model.md)
- [Patterns](architecture/patterns.md)
- [Architecture Decision Records](adr/README.md)

## Engineering

- [Development standards](engineering/development-standards.md)
- [Coding standards](engineering/coding-standards.md)
- [Deployment](engineering/deployment.md)
- [Security baseline](engineering/security-baseline.md)
- [Testing strategy](engineering/testing-strategy.md)

## Integrations

- [Discord integration](integrations/discord.md)
- [SRD source](integrations/srd-source.md)

## Provenance

- [Discussion record](provenance/discussion-record.md): durable record of the
  initial planning conversation.
- [Readiness review](provenance/readiness-review.md): comparison against
  `cepheus-amplify`, `delta-v`, and upstream SRD source.
- [Delta-V transfer](provenance/delta-v-transfer.md): what was reviewed and
  transferred from `~/Source/delta-v`.
- [Data salvage](provenance/data-salvage.md): what was copied from
  `cepheus-amplify` and what was intentionally left behind.

## Historical Material

Legacy review notes live under [`../legacy`](../legacy). Treat those as
historical source material. Promote any still-relevant item into the active docs
or issue tracker before implementing it.
