# Contributing

Cepheus Online is currently a small rewrite project. Keep changes narrow,
tested, and aligned with the source boundaries.

## Setup

```bash
npm install
npm run prepare
```

`npm run prepare` installs Husky hooks for local commits.

## Common Commands

```bash
npm run format
npm run lint
npm run check
npm test
npm run verify
```

- `format` writes Biome formatting changes.
- `lint` runs Biome checks.
- `check` runs TypeScript without emitting.
- `test` compiles tests to `build/test` and runs Node's test runner.
- `verify` runs lint, typecheck, and tests.

## Hooks

The pre-commit hook runs:

```bash
npm run lint
npm run check
```

The pre-push hook runs:

```bash
npm run verify
```

Set `HUSKY=0` only when you have already run the equivalent checks manually and
need to bypass hooks for a local workflow issue.

## Source Rules

- `src/shared` imports only `src/shared`.
- `src/server` imports `src/shared` and `src/server`.
- `src/client` imports `src/shared` and `src/client`.
- Runtime dependencies remain zero unless an architectural decision explicitly
  accepts one.
- Local published-product asset folders such as `Geomorphs/` and `Counters/`
  must not be committed.

Read [AGENTS.md](AGENTS.md) and
[docs/engineering/coding-standards.md](docs/engineering/coding-standards.md)
before making structural changes.
