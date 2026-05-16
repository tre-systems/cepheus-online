# ADR 0007: Version Events And Ruleset Data

## Status

Accepted.

## Context

Rooms persist authoritative history as event envelopes. Character creation and
future game rules depend on ruleset data that users will eventually customize.
Rulesets must therefore remain JSON data selected by a room, not TypeScript
application structure.

## Decision

- Event envelopes use `EVENT_ENVELOPE_VERSION` as the schema version for
  ordering metadata around each event.
- Event payload compatibility is handled in projectors and command handlers;
  historical event streams are not rewritten in place.
- Rulesets are loaded through a provider boundary that returns decoded data plus
  stable metadata: id, version, content hash, and source.
- Missing legacy ruleset IDs may use the documented default
  `cepheus-engine-srd`. Unknown explicit ruleset IDs fail closed.
- Future custom rulesets must follow the same load, decode, hash, select, and
  project path as bundled JSON rulesets.

## Consequences

- Projections can replay old event streams while new code adds compatibility
  branches deliberately.
- Room diagrams and docs can refer to a single ruleset provider boundary.
- Custom ruleset upload/storage can be added later without changing command,
  projection, viewer-filtering, or client-view call sites again.
