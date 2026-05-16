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

Discord OAuth should establish identity, but the app should still issue its own
session. Store Discord user IDs and guild mappings server-side. Do not rely on
client-provided Discord names, roles, or avatar URLs for authorization.

Campaign Discord integration should be explicit:

- link a campaign to a guild/channel
- map Discord roles to app roles where the referee opts in
- invite users through Discord interactions or signed app links
- post summaries, rolls, and handouts only when configured

## Room Access

Friendly campaign links can be short and human-shareable, but permissions
should be account-backed. A user who has a link should still need a valid role
for private campaigns.

Until Discord/session auth is implemented, the browser creates a local actor
session secret and sends it with commands. The room Durable Object binds the
first secret it sees for a room actor ID and rejects later commands for that
actor ID from a different secret. This is a development-phase anti-tampering
guard, not a replacement for authenticated identity: a room actor ID can still
be claimed by the first browser that uses it.

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
- per-IP limits for create, invite, login callback, and WebSocket upgrade
- per-socket message limits inside the Durable Object
- slow-path limits for imports, SRD parsing, and uploaded asset processing
- R2 size/type validation for uploaded images

Add global Cloudflare rate-limit bindings or WAF rules when public usage makes
per-isolate in-memory limits insufficient.

## Data Retention

Decide retention before production:

- event streams for active campaigns
- archived campaign exports
- Discord account links
- telemetry and error reports
- uploaded assets

Campaign data will be more personal than Delta-V match data. Treat notes,
character sheets, Discord IDs, and uploaded images as user data with explicit
delete/export paths.
