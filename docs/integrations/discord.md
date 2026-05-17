# Discord Integration

Discord is the private-beta sign-in provider and social layer. It is not the
source of truth for game state or room permissions.

## Identity

Use Discord OAuth for sign-in and account linking. The Worker implements:

- `GET /auth/discord/start`
- `GET /auth/discord/callback`
- `GET /api/session`
- `POST /api/logout`

Store:

- stable Discord user id
- display name
- avatar URL
- linked internal user id

Do not use mutable display names as durable identifiers.

## Session Model

The app issues its own signed HTTP-only session cookie after Discord OAuth
completes. D1 stores users and sessions; game permissions refer to internal
user ids and D1 room membership rows. Discord data is profile and integration
metadata.

Required configuration:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`
- `APP_BASE_URL`

The Discord redirect URL must be:

```text
${APP_BASE_URL}/auth/discord/callback
```

`SESSION_SECRET` must be a high-entropy secret set with Wrangler or the
Cloudflare dashboard. Do not put it in `wrangler.jsonc`.

## Room Invites

Room owners and referees can create signed app invite tokens. Accepting an
invite creates a D1 membership with one of `REFEREE`, `PLAYER`, or `SPECTATOR`.
`OWNER` is assigned only when a room is created.

Hosted room routes ignore browser-supplied viewer roles. The Worker resolves
membership and forwards trusted headers to the room Durable Object.

## Bot And Slash Commands

Useful future commands:

- `/create-game`
- `/invite`
- `/roll`
- `/initiative`
- `/session-summary`
- `/link-game`

The bot can later post game links, dice rolls, and session summaries into
campaign channels. Bot/slash commands are post-MVP.

## Role Mapping

Guild roles can later map to app permissions, but the app should cache and
revalidate them rather than assuming Discord role state is always available.

Potential mappings:

- server admin -> app owner/admin
- campaign role -> game participant
- spectator role -> game spectator

## Voice And Video

Do not build voice/video into the first rewrite. The original video was right:
Discord already solves this well and can run beside the app.
