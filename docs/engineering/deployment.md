# Deployment

Cepheus Online deploys to `https://cepheus.tre.systems` as a Cloudflare Worker
with a `GameRoomDO` Durable Object binding, a D1 database, and an R2 asset
bucket. The browser shell is embedded during the deploy build.

## Cloudflare Bindings

`wrangler.jsonc` defines local defaults and these runtime bindings:

| Binding | Purpose |
| --- | --- |
| `GAME_ROOM` | Durable Object namespace for live rooms. |
| `CEPHEUS_DB` | D1 users, sessions, rooms, memberships, invites, and asset metadata. |
| `ASSET_BUCKET` | R2 uploaded board and counter images. |
| `APP_BASE_URL` | Public app origin used for OAuth redirects and invite URLs. |
| `DISCORD_CLIENT_ID` | Discord OAuth client id. |

Required secrets:

- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`

Set secrets with Wrangler:

```bash
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

Apply D1 migrations before a private-beta deploy:

```bash
wrangler d1 migrations apply cepheus-online-private-beta --remote
```

The committed `wrangler.jsonc` keeps a placeholder D1 `database_id`; GitHub
Actions creates the D1 database if needed, resolves the UUID from the Cloudflare
database name, and applies remote migrations before deployment. Manual deploys
can either replace the placeholder locally or run:

```bash
node scripts/resolve-cloudflare-d1-database-id.mjs
```

## Local Checks

```bash
npm run verify
npm run deploy:dry-run
```

`deploy:dry-run` builds the client assets and asks Wrangler to validate the
Worker bundle without publishing it.

`verify` also checks internal documentation links so release notes and
operating docs do not drift to missing local files or anchors.

## Production Smoke

After a deploy, run the dependency-free deployed Worker smoke:

```bash
CEPHEUS_SMOKE_SESSION_COOKIE='cepheus_session=...' npm run smoke:deployed
```

The script defaults to `https://cepheus.tre.systems`. Override the target with a
positional URL, `CEPHEUS_SMOKE_URL`, or `WORKER_URL`:

```bash
CEPHEUS_SMOKE_SESSION_COOKIE='cepheus_session=...' npm run smoke:deployed -- https://your-preview.workers.dev
```

Use a private-beta owner session cookie copied from the deployed origin after
Discord sign-in; either the full `cepheus_session=...` pair or only the cookie
value is accepted. The smoke checks health endpoints, shell assets, PWA
manifest/icon/service worker assets, unauthenticated auth failures, protected
room creation, a disposable room command flow, stale `expectedSeq` rejection,
and viewer filtering for hidden pieces. The WebSocket broadcast check runs only
when the smoke can use unauthenticated local room access; browser-managed
cookies are required for protected deployed WebSockets.

## GitHub Actions

The `Deploy` workflow runs on pull requests and pushes to `main`.

- Pull requests run verification and a Wrangler dry run.
- Pushes to `main` run the same checks and then deploy to Cloudflare.
- Manual deploys can be started with `workflow_dispatch`.

Required repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers Scripts edit,
  Workers Routes edit if custom routes are added, Durable Objects edit, D1
  edit, and R2 edit permissions for the account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id.
- `DISCORD_CLIENT_SECRET`: Discord OAuth client secret for the Worker
  environment.
- `SESSION_SECRET`: high-entropy app session signing secret for the Worker
  environment.

The deploy workflow creates or resolves a Cloudflare D1 database named
`cepheus-online-private-beta`; it resolves the database UUID from that name at
deploy time.

The workflow deploys with:

```bash
wrangler deploy \
  --domain cepheus.tre.systems \
  --var APP_BASE_URL:https://cepheus.tre.systems \
  --var DISCORD_CLIENT_ID:set-with-wrangler-secret-or-env
```

Keeping the production URL in the workflow avoids breaking local `wrangler dev`
and Playwright runs, which rely on localhost-only test routes.

Set them with GitHub CLI:

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo tre-systems/cepheus-online
gh secret set CLOUDFLARE_API_TOKEN --repo tre-systems/cepheus-online
gh secret set DISCORD_CLIENT_SECRET --repo tre-systems/cepheus-online
gh secret set SESSION_SECRET --repo tre-systems/cepheus-online
```

The production hostname is managed as a Worker custom domain in the deploy
workflow. Keep the deployed `APP_BASE_URL` aligned with that hostname so OAuth
redirects and invite URLs use the public origin.
