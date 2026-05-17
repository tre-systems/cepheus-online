# Implementation Plan

Last reviewed: 2026-05-17.

This is the active engineering backlog. Completed work belongs in `git log`;
historical review notes belong under `docs/provenance/` or `legacy/`.

## Private-Beta MVP Baseline

The current application has the private-beta spine in place:

- Cloudflare Worker routes with one `GameRoomDO` per live room.
- Discord OAuth sign-in, signed HTTP-only app sessions, D1 users/sessions,
  rooms, memberships, invites, and membership-backed hosted room access.
- Server-ordered commands, event storage, checkpoints, replay projection,
  synced dice reveal timing, and viewer-safe state responses.
- Dependency-free browser shell with Canvas board play, WebSocket updates,
  room switching, PWA shell assets, and disposal-safe client wiring.
- Guided SRD character creation through semantic server commands/events,
  legal-action projection, reveal-safe dice, mustering, finalization, and
  completed-sheet display.
- R2-backed uploaded board/counter image assets with D1 metadata, protected
  asset serving, asset picker integration, board/piece creation, door state,
  LOS sidecar validation, and hidden-piece viewer filtering.
- Server-ordered plain-text notes and handouts with referee mutation controls
  and viewer filtering.
- Owner room export/delete paths covering D1 metadata, Durable Object room
  data, note state, asset manifests, and R2 cleanup.
- Rulesets loaded as JSON data through the provider boundary. The bundled SRD
  ruleset is `data/rulesets/cepheus-engine-srd.json`.
- Local verification for generated assets, lint, docs, boundaries, diagrams,
  TypeScript, unit tests, character-creation E2E, tactical-board E2E, and
  Cloudflare deploy dry runs.

## Active Release Checklist

- Confirm the `cepheus-online-assets` R2 bucket exists before exercising asset
  uploads in production.
- Configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `SESSION_SECRET`
  for the target environment.
- Add the Discord redirect URL `${APP_BASE_URL}/auth/discord/callback`.
- Run `npm run verify:full`.
- Run `npm run deploy:dry-run`.
- Deploy a candidate and run
  `CEPHEUS_SMOKE_SESSION_COOKIE='cepheus_session=...' npm run smoke:deployed -- <candidate-url>`.
- Complete the mobile PWA manual checklist on a real phone: install, reload,
  offline shell fallback, update activation, and reconnect recovery.
- Run the private-beta manual checks in
  [testing strategy](../engineering/testing-strategy.md#private-beta-manual-checks).

## Post-MVP Product Work

- Broader tactical play: board composition, richer prep/admin mode, visibility
  controls, extraction/review/editing for LOS sidecars, initiative, combat,
  damage, healing, armor, range, cover, fatigue, and status helpers.
- Player economy and equipment: continue event-backed item and credit-ledger
  commands rather than whole-list replacement.
- Ruleset storage: custom ruleset upload/storage after validation, moderation
  limits, source identity, and id/version/hash migration policy are defined.
- Discord bot/slash commands for game links, rolls, and summaries after the
  OAuth/invite MVP is stable.
- Collaborative documents only when plain server-ordered notes are not enough.

## Guardrails

- Keep `app.ts` as the boot entrypoint and `createAppClient()` as the browser
  runtime boundary.
- Keep `GameRoomDO` as a Cloudflare lifecycle shell over command, publication,
  broadcast, reveal, storage, query, and route/socket helpers.
- Keep `runCommandPublication()` as the only persistence, projection,
  checkpoint, parity, telemetry, and state-response path.
- Keep rulesets as JSON data. Production code should not import bundled
  resolver shortcuts outside provider setup.
- Keep viewer filtering server-side before state leaves the room.
- Keep runtime dependencies at zero unless an ADR accepts an exception.

## Do Not Start Yet

- In-app chat. Discord remains the chat and narrative layer.
- CRDTs for notes before a concrete collaborative editing need exists.
- React, Material UI, Amplify, DataStore, XState, Zustand, or schema-form UI.
- Public-room launch hardening before private-beta access, export/delete,
  viewer filtering, and rate limits have been tested against real tables.
- Large combat UI before character creation and tactical scene flows are stable.
