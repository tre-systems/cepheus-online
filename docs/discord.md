# Discord Integration

Discord should be a first-class integration, but not the source of truth for
game state.

## Identity

Use Discord OAuth for sign-in and account linking.

Store:

- stable Discord user id
- display name
- avatar URL
- optional email when granted
- linked internal user id

Do not use mutable display names as durable identifiers.

## Session Model

The app should issue its own session after Discord OAuth completes. Game
permissions should refer to internal user ids. Discord data is profile and
integration metadata.

## Bot And Slash Commands

Useful commands:

- `/create-game`
- `/invite`
- `/roll`
- `/initiative`
- `/session-summary`
- `/link-game`

The bot can post game links, dice rolls, and session summaries into campaign
channels.

## Role Mapping

Guild roles can map to app permissions, but the app should cache and revalidate
them rather than assuming Discord role state is always available.

Potential mappings:

- server admin -> app owner/admin
- campaign role -> game participant
- spectator role -> game spectator

## Voice And Video

Do not build voice/video into the first rewrite. The original video was right:
Discord already solves this well and can run beside the app.
