# Data

This directory contains copied and generated rules material. It is source data,
not application logic.

## Current Layout

```text
data/rulesets/
  cepheus-engine-srd.json

docs/provenance/data-salvage/
  cepheus-engine-srd-legacy-import.json
  csc/
  srd-experiments/
```

## Meaning

- `data/rulesets/cepheus-engine-srd.json` is the canonical bundled runtime
  ruleset. Production code must consume this file only through the ruleset
  provider boundary.
- `docs/provenance/data-salvage/` contains historical salvage artifacts,
  Central Supply Catalogue parser inputs/outputs, SRD experiments, and WIP
  generation files. They are preserved for traceability and are not runtime
  inputs.

## Organization Target

Runtime code should continue to read canonical ruleset JSON files through the
provider boundary:

```text
data/rulesets/<slug>.json
```

Future importers should live outside the runtime data path. Raw parser inputs,
temporary WIP files, and generated experiments should stay out of production
consumption.
