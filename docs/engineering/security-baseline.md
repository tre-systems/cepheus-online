# Security Baseline

This is the starting security model for the rewrite. It focuses on Discord
identity, campaign privacy, referee hidden state, and Cloudflare cost controls.

## Authority

The server owns game truth. Clients submit commands; the room Durable Object
validates and orders them. Browser state is not trusted for rules, permissions,
dice, hidden visibility, or access control.

## Anti-Cheat And Rules Integrity

The client is not trusted for dice, character creation outcomes, final sheet
facts, permissions, or hidden data. The room Durable Object must validate
command shape, actor authority, `expectedSeq`, legal actions, and rules state
before appending events.

Character creation is server-authored. Players use semantic creation commands
for characteristics, homeworld, career terms, rolls, mustering, and
finalization. Manual `UpdateCharacterSheet` patches from non-referees are
notes-only; age, characteristics, skills, equipment, and credits are
creation-owned fields that only a referee may correct manually.

In-play equipment and credit changes use dedicated item/ledger commands rather
than whole-sheet replacement. For the current public-room phase, those commands
are referee-only so a player cannot mint credits or equipment by editing their
browser request.

## Discord Identity

Discord OAuth establishes private-beta identity. The app issues its own signed
HTTP-only session cookie after OAuth completes and stores the session in D1.
Store Discord user IDs server-side. Do not rely on client-provided Discord
names, roles, or avatar URLs for authorization.

Campaign Discord integration should be explicit:

- link a campaign to a guild/channel
- map Discord roles to app roles where the referee opts in
- invite users through Discord interactions or signed app links
- post summaries, rolls, and handouts only when configured

## Room Access

Friendly campaign links can be short and human-shareable, but permissions
should be account-backed. A user who has a link should still need a valid role
for private campaigns.

Hosted room state, command, WebSocket, asset, export, and delete routes require
an authenticated app session plus D1 room membership. The Worker resolves the
member role and forwards trusted user and viewer-role headers to the Durable
Object. Browser-supplied viewer query parameters are ignored on hosted
requests.

Local/test hosts may still use the actor-session secret path for development
and E2E tests. The room Durable Object binds the first secret it sees for a
room actor ID and rejects later commands for that actor ID from a different
secret. This remains an anti-replay guard, not the hosted authorization model.

Suggested role model:

- owner
- referee
- player
- spectator
- pending invite

## Hidden Data

The browser must never receive data hidden from that viewer. Filter server-side
for every WebSocket broadcast, HTTP state read, replay view, and exported
campaign bundle.

High-risk hidden data:

- hidden board pieces and unrevealed rooms
- NPC stats and referee notes
- viewer-safe character creation and finalization payloads, especially private
  notes and unrevealed roll-dependent outcomes
- dice rolls and roll-derived consequences before `revealAt`; public browser
  responses should expose only pending-roll metadata until the shared reveal
  boundary, even for owners and referees unless a deliberately separate
  diagnostic path is added
- private handouts
- secret map layers
- pending encounters
- other players' private character notes where configured

## Trusted HTML Boundary

All HTML rendering must pass through `src/client/dom.ts`. Freeform user content
from notes, chat, names, Discord, or SRD imports should render as text unless a
sanitizer is deliberately installed inside the trusted HTML boundary.

## Rate Limits and Abuse Controls

Initial Cloudflare controls should include:

- body size limits on JSON routes
- per-IP/session in-memory limits for Discord OAuth start/callback, room
  creation, invite creation/acceptance, asset upload, hosted room commands, and
  WebSocket upgrades
- per-socket message limits and per-actor command limits inside the Durable
  Object
- slow-path limits for imports, SRD parsing, and uploaded asset processing
- R2 size/type/dimension validation for uploaded images

Add global Cloudflare rate-limit bindings or WAF rules when public usage makes
per-isolate in-memory limits insufficient.

## Data Retention

Private-beta retention is explicit owner control:

- event streams for active campaigns
- owner-triggered campaign exports
- Discord account links
- telemetry and error reports when added
- uploaded assets

Campaign data will be more personal than Delta-V match data. Treat notes,
character sheets, Discord IDs, and uploaded images as user data with explicit
delete/export paths.
