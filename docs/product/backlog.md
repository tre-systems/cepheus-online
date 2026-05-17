# Implementation Plan

Last reviewed: 2026-05-17.

This is the active engineering backlog. It contains work that still needs a
named home. Shipped work belongs in `git log`; historical review notes belong
under `docs/provenance/` or `legacy/`.

## MVP Baseline

The current application has a playable spine:

- Cloudflare Worker routes with one `GameRoomDO` per live room.
- Server-ordered commands, event storage, checkpoints, replay projection, and
  viewer-safe state responses.
- Dependency-free browser shell with Canvas board play, room switching, PWA
  shell assets, WebSocket updates, synced dice reveal timing, and disposal-safe
  client wiring.
- Guided character creation through the SRD procedure, including semantic
  server commands/events, legal-action projection, live follower activity,
  reveal-safe dice, mustering, finalization, and completed-sheet display.
- Local map/counter asset metadata paths, board/piece creation, door state, LOS
  sidecar validation, and hidden-piece viewer filtering.
- Rulesets loaded as JSON data through the provider boundary. The bundled SRD
  ruleset is `data/rulesets/cepheus-engine-srd.json`.
- CI and local verification for generated assets, lint, docs, boundaries,
  diagrams, TypeScript, unit tests, character-creation E2E, tactical-board E2E,
  and Cloudflare deploy dry runs.

## Active Priorities

### 1. Release Hardening

- Run `npm run smoke:deployed` after the next deployed candidate.
- Run `npm run deploy:dry-run` before release publishing.
- Complete the mobile PWA manual checklist on a real phone: install, reload,
  offline shell fallback, update activation, and reconnect recovery.
- Confirm `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are present in
  GitHub/Cloudflare settings.
- Decide when to add a custom domain or route in `wrangler.jsonc`; the
  workers.dev host is acceptable until then.
- Decide retention/export/delete policy before real campaign data is stored.

### 2. Character Creation Polish

- Keep reducing legacy compatibility adapters. Historical
  `CharacterCreationTransitioned` replay must continue to project, but new UI,
  activity cards, and provenance should read semantic facts.
- Keep expanding the projection-fed creator view model until each step consumes
  one shape for phase, prompt, legal actions, pending choices, progress, roll
  facts, button state, and sheet preview.
- Polish injury, anagathics, reenlistment, mustering, and completed-sheet copy
  so the rules outcome is clear on phone-sized screens.
- Extend final sheet/export provenance only where it improves table use:
  careers, ranks, benefits, aging effects, credits, equipment, UPP, and notes.
- Keep reveal/filtering tests current for every new roll-bearing semantic
  event, including future replay/activity history and Discord logging.

### 3. Tactical Table And Referee Tools

- Build the production asset path from local file metadata to durable uploaded
  asset ids without committing licensed product files.
- Add board composition and richer board-management controls for referee prep.
- Expand LOS sidecar support from validation/persistence into extraction,
  review, manual correction, and editing.
- Add referee controls for visibility, prep/admin mode, and direct scene
  management while preserving viewer filtering.
- Keep tactical E2E coverage focused on board creation, piece creation,
  movement, door state, refresh recovery, and hidden-piece filtering.

### 4. Public Play, Security, And Identity

- Implement Discord OAuth, internal app sessions, room authorization, and
  invite flow.
- Add public-room rate limits for commands, WebSocket upgrades/messages,
  imports, and uploaded assets.
- Expand viewer-filtering coverage for notes, handouts, secret map layers, and
  future Discord-linked identity.
- Add diagnostics that summarize failures without logging secrets, tokens, raw
  IPs, or hidden game state.
- Add export/delete paths once retention policy is decided.

### 5. Broader Cepheus Rules

- Add action-sheet skill rolls using the same server dice and reveal path.
- Add combat, damage, healing, armor, initiative, range, cover, fatigue, and
  status helpers as pure shared rules.
- Continue equipment and credit-ledger work through event-backed item/ledger
  commands rather than whole-list replacement.
- Add notes and handouts as server-ordered blocks. Use CRDTs only if a concrete
  document-collaboration need appears.
- Add custom ruleset upload/storage only after validation, moderation limits,
  storage source, and ruleset id/version/hash migration policy are defined.

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
- Public Discord room authorization before viewer filtering and rate limits are
  ready for real campaign data.
- Large combat UI before character creation and tactical scene flows are stable.
