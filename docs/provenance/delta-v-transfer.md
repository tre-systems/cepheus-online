# Delta-V Transfer

This repo deliberately borrows the parts of Delta-V that made it reliable:
small primitives, explicit state ownership, event-sourced authority, and a
dependency-light browser client. It does not copy Delta-V game rules,
renderer assets, AI logic, combat systems, or competitive matchmaking.

## Reviewed Source Areas

- `/Users/robertgilks/Source/delta-v/patterns/engine-and-architecture.md`
- `/Users/robertgilks/Source/delta-v/patterns/protocol-and-persistence.md`
- `/Users/robertgilks/Source/delta-v/patterns/client.md`
- `/Users/robertgilks/Source/delta-v/patterns/testing.md`
- `/Users/robertgilks/Source/delta-v/docs/CODING_STANDARDS.md`
- `/Users/robertgilks/Source/delta-v/docs/SECURITY.md`
- `/Users/robertgilks/Source/delta-v/docs/OBSERVABILITY.md`
- `/Users/robertgilks/Source/delta-v/src/client/reactive.ts`
- `/Users/robertgilks/Source/delta-v/src/client/dom.ts`
- `/Users/robertgilks/Source/delta-v/src/shared/prng.ts`
- `/Users/robertgilks/Source/delta-v/src/shared/util.ts`

## Transferred Now

- `src/client/reactive.ts`: zero-dependency signals, computed values, effects,
  batching, and disposal scopes.
- `src/client/dom.ts`: framework-free DOM helpers, auto-disposed listeners,
  signal-aware visibility/text/class helpers, and a single trusted HTML
  boundary.
- `src/shared/prng.ts`: deterministic seeded PRNG and per-event RNG derivation.
- `src/shared/util.ts`: small collection helpers that keep shared rules code
  data-oriented.
- `docs/architecture/patterns.md`: Cepheus-specific adaptation of Delta-V's engine,
  protocol, client, and testing patterns.
- `docs/engineering/development-standards.md`: dependency, boundary, naming, and testing
  standards for this rewrite.
- `docs/engineering/security-baseline.md`: first-pass security posture for Discord auth,
  room access, hidden referee data, and Cloudflare cost controls.
- `docs/engineering/testing-strategy.md`: staged test strategy for the current skeleton and
  later Cloudflare/browser work.

## Adapted Rather Than Copied

The high-level Delta-V architecture maps well, but Cepheus Online has a
different product shape:

- Campaign rooms are long-lived. Delta-V matches are short tactical sessions.
- Referee hidden state is richer than hidden ship identity.
- Player workflows include character creation, equipment, notes, handouts, and
  campaign administration.
- Discord is expected to be an identity and campaign integration surface, not
  just an external chat channel.

For that reason, the useful inheritance is pattern-level:

- commands become events through one authoritative Durable Object path
- every broadcast carries a viewer-safe projection
- clients replace authoritative state wholesale
- local UI planning state is disposable and never becomes server truth
- deterministic dice/random tables use injected RNG, not `Math.random`
- replay and reconnection use the same projector as live play

## Intentionally Not Carried Forward

- Delta-V renderer modules: useful inspiration, but too tactical-space specific.
- AI, rating, leaderboard, and MCP code: out of scope for the first Cepheus
  rewrite.
- Competitive quick-match flows: not needed before campaign rooms and Discord
  invites work.
- Delta-V assets: unrelated to Cepheus Engine and not part of this product.
