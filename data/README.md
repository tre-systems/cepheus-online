# Data

This directory contains copied and generated rules material. It is source data,
not application logic.

## Current Layout

```text
data/rulesets/
  cepheus-engine-srd.json
  csc_*.txt / csc_*.json
  srd/
    robs-cepheus-ruleset.json
    wip/

docs/provenance/data-salvage/
  cepheus-engine-srd-legacy-import.json
  parse-armour.js
  parse-weapons.ts
```

## Meaning

- `data/rulesets/cepheus-engine-srd.json` is the canonical bundled runtime
  ruleset. Production code must consume this file only through the ruleset
  provider boundary.
- `data/rulesets/` is the broader legacy working area copied from
  `cepheus-amplify`, including SRD experiments, Central Supply Catalogue parser
  inputs/outputs, and work-in-progress generation files. It is not a second
  runtime ruleset source.
- `data/rulesets/srd/` contains non-runtime SRD-derived ruleset experiments and
  WIP source data.
- `docs/provenance/data-salvage/` contains historical salvage artifacts that are
  preserved for traceability but are not runtime inputs or runnable importers.

## Organization Target

Runtime code should continue to read canonical ruleset JSON files through the
provider boundary:

```text
data/rulesets/<slug>.json
```

Future importers should live outside the runtime data path. Raw parser inputs,
temporary WIP files, and generated experiments should stay out of production
consumption.
