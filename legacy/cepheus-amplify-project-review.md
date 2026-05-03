# Project Review Notes

This document captures a lightweight review pass, a prioritized TODO list, and
design recommendations for improving Cepheus Online.

## Scope

- Frontend UI flows (character creation, initiative, board pieces)
- Data and store logic related to character state
- Invite flow (Amplify Lambda + Cognito)

## TODO List (Prioritized)

1. Fix Cognito email lookup in the invite Lambda (use the `Users` array from
   `listUsers`).
2. Narrow the "user not found" branch when generating usernames to
   `UserNotFoundException`; rethrow other errors.
3. Generate temporary passwords using a crypto-safe method and align with the
   user pool password policy.
4. Prevent NaN/invalid initiative values from being stored; treat empty input as
   `null`.
5. Guard damage calculations against zero or missing health values to avoid
   invalid overlays.
6. Add error + loading states for slug-based game lookup and handle GraphQL
   failures gracefully.
7. Add invite-flow tests: existing user by email, unsubscribed users, and
   duplicate invites.
8. Add unit tests for initiative input edge cases and damage overlay edge cases.

## Design Recommendations

- Expand design tokens in `src/theme.ts` with semantic colors (success/warn/error),
  spacing scale, and surface elevations to reduce inline styling.
- Keep the neon-green sci-fi accent, but introduce a muted secondary palette for
  form-heavy screens to reduce visual fatigue.
- Add a subtle background texture (grid/scanlines) and panel borders to improve
  depth without sacrificing readability.
- Improve mobile ergonomics: sticky primary action bar in character creation,
  larger touch targets for step actions, and clearer step headers.
- Add micro-interactions for key flows (e.g., benefit roll results and initiative
  changes) with brief highlight animations.
- Create a compact HUD layout for the 3D board (initiative, dice history,
  selected piece details) that collapses on smaller screens.
