# Data

This directory contains copied and generated rules material. It is source data,
not application logic.

## Current Layout

```text
data/ruleset/
  cepheus-engine-srd.json

data/rulesets/
  csc_*.txt / csc_*.json
  parse-*.js / parse-*.ts
  srd/
    cepheus-engine-srd.json
    robs-cepheus-ruleset.json
    wip/
```

## Meaning

- `data/ruleset/` is the single ruleset JSON copied from the old application
  import path.
- `data/rulesets/` is the broader legacy working area copied from
  `cepheus-amplify`, including SRD experiments, Central Supply Catalogue parser
  inputs/outputs, and work-in-progress generation files.
- `data/rulesets/srd/` contains SRD-derived ruleset files and WIP source data.

The two `cepheus-engine-srd.json` files are similar but not identical. Keep both
for now as provenance until an importer or normalization script defines the
canonical output.

## Organization Target

Before runtime code consumes this data, normalize it into:

```text
data/rulesets/<slug>.json
data/importers/<source-name>/
```

At that point, application code should read only canonical ruleset JSON files.
Raw parser inputs, temporary WIP files, and generated experiments should stay out
of the runtime path.
