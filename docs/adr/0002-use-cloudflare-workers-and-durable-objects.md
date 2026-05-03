# ADR 0002: Use Cloudflare Workers and Durable Objects

Status: Accepted

Date: 2026-05-03

## Context

Amplify Gen 2 does not include DataStore, and the old app's DataStore model does
not give the explicit conflict behavior needed for concurrent tabletop play.
The target application needs ordered room state, WebSockets, cheap hibernation,
and server-side filtering of referee-only data.

## Decision

Use Cloudflare Workers for HTTP routes and static application delivery. Use one
or more Durable Objects for live game rooms, ordered command processing,
WebSocket coordination, event persistence, checkpoints, and presence.

Use D1 for user/account indexes and operational metadata when needed. Use R2 for
uploaded assets and archived bundles.

## Consequences

- Room mutation has a natural authoritative owner.
- Ordered command processing is easier to reason about than client-side
  optimistic whole-object writes.
- Hibernatable WebSockets and Durable Object storage fit live rooms well.
- The project must define its own auth/session, persistence, migration, and
  observability conventions.
