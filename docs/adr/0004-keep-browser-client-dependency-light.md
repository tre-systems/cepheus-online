# ADR 0004: Keep the Browser Client Dependency-Light

Status: Accepted

Date: 2026-05-03

## Context

Delta-V showed that a rich browser game can stay fast and maintainable with
plain TypeScript, Canvas, CSS, and small local helpers. The old Cepheus app
depended on heavy UI and form libraries that made the client harder to steer.

## Decision

Default to no runtime dependencies in the browser. Use plain TypeScript, CSS,
Canvas 2D, browser APIs, and the local reactive/DOM helpers. Avoid Material UI,
RJSF, Amplify DataStore client libraries, and React-heavy board implementations.

Allow a dependency only when it is hard to replace correctly, has a small
surface area, and is isolated behind a local adapter.

## Consequences

- The first client remains small and directly tailored to the game.
- UI implementation work is more explicit.
- Preact remains an option if complex hand-built forms become a real maintenance
  burden.
- WebGL remains an option for a specific board mode, not the default rendering
  requirement.
