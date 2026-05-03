# Architecture Decision Records

Architecture Decision Records capture accepted decisions that materially shape
the system. They are intentionally short: context, decision, and consequences.

## Accepted

- [ADR 0001: Start a Clean Rewrite](0001-start-clean-rewrite.md)
- [ADR 0002: Use Cloudflare Workers and Durable Objects](0002-use-cloudflare-workers-and-durable-objects.md)
- [ADR 0003: Use Server-Ordered Events for Game State](0003-use-server-ordered-events-for-game-state.md)
- [ADR 0004: Keep the Browser Client Dependency-Light](0004-keep-browser-client-dependency-light.md)
- [ADR 0005: Use Discord OAuth with Internal App Sessions](0005-use-discord-oauth-with-internal-app-sessions.md)
- [ADR 0006: Limit CRDTs to Document-Like Collaboration](0006-limit-crdts-to-document-like-collaboration.md)

## Open Decision Points

- Whether the first implementation uses Durable Object storage only or adds D1
  indexes immediately.
- Whether collaborative notes start as server-ordered blocks or a CRDT document.
- Whether Preact is worth adding later for complex forms.
- Exact Discord OAuth/session storage design.
- How much SRD text should be vendored versus imported at build time.
- Exact event chunk size and checkpoint cadence for long-running campaigns.

When one of these is resolved, add a new ADR and remove the item from this list.
