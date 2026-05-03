# Decisions

## Current

- Repo name: `cepheus-online`.
- Runtime dependency default: none.
- UI default: plain TypeScript, DOM, CSS, and Canvas.
- Backend target: Cloudflare Workers and Durable Objects.
- Auth target: Discord OAuth with internal app sessions.
- Sync target: server-authoritative commands and append-only events.
- CRDTs: allowed only for bounded document-like surfaces.
- Legacy app: reference and data source, not the implementation base.
- Delta-V patterns: borrow architecture and small utilities, not game-specific
  renderer, AI, or matchmaking code.
- Randomness: deterministic, injected RNG for rules and dice; no `Math.random`
  in shared rules code.

## Open

- Whether the first implementation uses Durable Object storage only or adds D1
  indexes immediately.
- Whether collaborative notes start as server-ordered blocks or Yjs documents.
- Whether Preact is worth adding later for complex forms.
- Exact Discord OAuth/session storage design.
- How much SRD text should be vendored versus imported at build time.
- Exact event chunk size and checkpoint cadence for long-running campaigns.
