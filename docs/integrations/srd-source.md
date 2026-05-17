# SRD Source

The upstream Cepheus Engine SRD source is:

[orffen/cepheus-srd](https://github.com/orffen/cepheus-srd)

Verified 2026-05-17: the default branch is `mdbook`, and the latest GitHub
release is `v9.1`, published 2025-07-06.

Useful upstream files include:

- `src/book1/character-creation.md`
- `src/book1/equipment.md`
- `src/book1/personal-combat.md`
- `src/book1/skills.md`
- `src/book2/ship-design-and-construction.md`
- `src/book2/space-combat.md`
- `src/book3/worlds.md`
- `src/book3/environments-and-hazards.md`
- `src/vds/*`
- `src/tools/*.js`

## License Notes

The upstream README states that the SRD text is designated Open Gaming Content
except named product identities and trademarks. The source code for displaying
the SRD is released under the Unlicense.

This project must preserve attribution and legal notices when importing or
displaying SRD material.

This is an engineering note, not legal advice.

## Import Strategy

Prefer a pinned importer over a git submodule.

Planned workflow:

1. Fetch a specific commit from `orffen/cepheus-srd`.
2. Convert Markdown into search/reference artifacts.
3. Extract curated tables into structured ruleset JSON where useful.
4. Record source repo, branch, commit, and import date in generated metadata.
5. Keep local house-rule data separate from upstream-derived data.
