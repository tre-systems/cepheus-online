# Diagrams

Graphviz/DOT sources and rendered PNGs live together here. Mermaid is reserved
for small inline diagrams inside Markdown.

## Files

| Diagram | Source | Rendered image |
| --- | --- | --- |
| Runtime architecture | `runtime-architecture.dot` | `runtime-architecture.png` |
| Command publication flow | `command-publication-flow.dot` | `command-publication-flow.png` |
| Ruleset data flow | `ruleset-data-flow.dot` | `ruleset-data-flow.png` |
| Client runtime boundaries | `client-runtime-boundaries.dot` | `client-runtime-boundaries.png` |
| Viewer filtering and reveal flow | `viewer-filtering-reveal-flow.dot` | `viewer-filtering-reveal-flow.png` |

## Conventions

Use the same Graphviz style as the SWADE toolbox docs: Avenir, rounded filled
boxes, HTML labels, clustered subsystems, and committed PNG renders.

## Render

`npm run check:diagrams` verifies every `.dot` file renders and has a committed
PNG next to it. To render all diagrams manually:

```bash
for src in docs/diagrams/*.dot; do dot -Tpng:cairo "$src" -Gdpi=220 -o "${src%.dot}.png"; done
```
