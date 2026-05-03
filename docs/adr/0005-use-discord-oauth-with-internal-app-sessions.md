# ADR 0005: Use Discord OAuth with Internal App Sessions

Status: Accepted

Date: 2026-05-03

## Context

Discord is already the natural social layer for many online tabletop groups.
The app should integrate with Discord for identity, invitations, and campaign
coordination, but game authorization still needs stable internal control.

## Decision

Use Discord OAuth for login and account linking. After OAuth completes, issue an
internal app session and authorize game actions against internal user ids and
campaign roles.

Discord guild/channel/role data can be linked to campaigns, cached, and
revalidated, but Discord is not the direct source of truth for game state.

## Consequences

- Players can join through a familiar identity provider.
- Campaigns can later gain Discord bot/slash-command integration.
- The app can survive Discord display-name, avatar, or role changes.
- Voice and video stay outside the first rewrite because Discord already solves
  those workflows well.
