# Contributing

Contributor workflow only. For architecture, coding conventions, and current
product priorities, start with [AGENTS.md](AGENTS.md) and the owner docs linked
from [docs/README.md](docs/README.md).

## Setup

```bash
npm install
npm run prepare
```

`npm run prepare` installs Husky hooks for local commits.

## Verification Commands

Use the narrowest command that proves the change.

| Command | Purpose |
| --- | --- |
| `npm run build:client` | Compiles `src/client/app` and embeds served assets in `src/server/static-client-assets.generated.ts`. |
| `npm run lint` | Runs Biome lint rules over source, scripts, JSON, and docs configured in `biome.json`. |
| `npm run check:docs` | Checks internal Markdown file and anchor links. |
| `npm run check:boundaries` | Enforces source-boundary safety rules that lint cannot express clearly. |
| `npm run check` | Runs TypeScript with `noEmit` for app source. |
| `npm test` | Compiles colocated tests and runs Node's built-in test runner. |
| `npm run verify:quick` | Fast non-test gate: build client, lint, docs, boundary checks, typecheck. |
| `npm run verify:full` | Full local gate: `verify:quick`, unit tests, character-creation E2E, and tactical-board E2E. |
| `npm run verify` | Alias for `verify:full`. |
| `npm run smoke:deployed -- <url>` | Production Worker smoke for routes, static assets, commands, viewer filtering, and WebSocket broadcasts. |

Expected checks by change type:

- Documentation only: `npm run check:docs`.
- Client shell: `npm run build:client && npm run verify:quick && npm test`.
- Shared rules, protocol, server, or projection: `npm run verify:full`.
- Deployment or Worker asset serving: `npm run verify:full && npm run deploy:dry-run`.
- Production confidence after deploy: `npm run smoke:deployed -- https://cepheus-online.rob-gilks.workers.dev/`.

## Hooks

The pre-commit hook inspects staged paths.

- Documentation-only commits run `npm run check:docs`.
- Code or tooling commits run `npm run verify:quick`.

The pre-push hook inspects the pushed diff.

- Documentation-only pushes run `npm run check:docs`.
- Normal pushes run `npm run verify:quick`.
- Set `CEPHEUS_FULL_PRE_PUSH=1` to run `npm run verify:full` before pushing.

Use `HUSKY=0` only when you have already run equivalent checks and need to
bypass hooks for a local workflow issue.

## CI And Dependency Hygiene

GitHub Actions runs `npm run verify` and a Cloudflare deploy dry-run for pushes
and pull requests targeting `main`. Pushes to `main` deploy only after that
verification job passes.

A scheduled dependency audit runs weekly with `npm audit --audit-level=high`.
Dependabot is configured for weekly npm patch updates with a small pull request
limit so dependency maintenance stays reviewable.

## Boundary Checks

`npm run check:boundaries` enforces rules that protect the architecture:

- no direct `innerHTML =` writes outside `src/client/dom.ts`
- no `Math.random` in non-test `src/shared`
- no `console.log`, `console.warn`, or `console.error` in non-test `src`
- no raw room HTTP helper imports from feature modules
- no legacy character-creation history reads outside the compatibility adapter
- no direct bundled-ruleset resolver imports outside provider setup
- no `.js` relative import specifiers in TypeScript source
- no new `// @ts-nocheck` files

Biome also enforces import-direction rules for `src/shared`, `src/server`, and
`src/client`.

## Source Rules

- `src/shared` imports only `src/shared`.
- `src/server` imports `src/shared` and `src/server`.
- `src/client` imports `src/shared` and `src/client`.
- TypeScript source uses extensionless relative imports and `import type` for
  type-only dependencies.
- Runtime dependencies remain zero unless an architectural decision explicitly
  accepts one.
- Development-only tooling is allowed when it improves consistency without
  changing the shipped app.
- Local published-product asset folders such as `Geomorphs/` and `Counters/`
  must not be committed.

## Browser Testing Direction

Playwright E2E coverage is part of `npm run verify:full`. Keep browser tests
focused on browser-only contracts: boot, layout, two-tab follow behavior, dice
reveal timing, Canvas input, reconnect, PWA behavior, and failure artifacts.
Rules and state machines belong in unit tests.

## Documentation

One owner doc per topic. Update the relevant owner doc when behavior,
architecture, routes, schemas, or operating procedures change. Link to existing
docs rather than duplicating long explanations.
