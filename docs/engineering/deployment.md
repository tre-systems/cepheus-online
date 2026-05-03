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
