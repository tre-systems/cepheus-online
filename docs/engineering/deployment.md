# Deployment

Cepheus Online deploys as a Cloudflare Worker with a `GameRoomDO` Durable
Object binding. The browser shell is embedded during the deploy build.

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
npm run smoke:deployed
```

The script defaults to `https://cepheus-online.rob-gilks.workers.dev`. Override
the target with a positional URL, `CEPHEUS_SMOKE_URL`, or `WORKER_URL`:

```bash
npm run smoke:deployed -- https://your-preview.workers.dev
```

The smoke checks health endpoints, shell assets, PWA manifest/icon/service
worker assets, a disposable room command flow, stale `expectedSeq` rejection,
viewer filtering for hidden pieces, and WebSocket room-state broadcasts when
Node's built-in `WebSocket` is available.

## GitHub Actions

The `Deploy` workflow runs on pull requests and pushes to `main`.

- Pull requests run verification and a Wrangler dry run.
- Pushes to `main` run the same checks and then deploy to Cloudflare.
- Manual deploys can be started with `workflow_dispatch`.

Required repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers Scripts edit,
  Workers Routes edit if custom routes are added, and Durable Objects edit
  permissions for the account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id.

Set them with GitHub CLI:

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo tre-systems/cepheus-online
gh secret set CLOUDFLARE_API_TOKEN --repo tre-systems/cepheus-online
```

The initial deployment uses the default workers.dev host from
`wrangler.jsonc`. Add a route or custom domain to `wrangler.jsonc` when the
production hostname is ready.
