# Remote staging deploy — proposal

`deploy-staging.yml` in this directory is a GitHub Actions workflow that lets
staging be deployed from GitHub (phone, ChatGPT, anywhere) instead of from the
local Claude desktop machine.

**It is parked here, not installed.** It targets the PlacidCRM application
repository, which this repository is not — this repo is the GitHub profile
README. It is kept out of `.github/workflows/` on purpose so it does not
register as a live workflow here and fail on every push.

## Install

1. Copy `deploy-staging.yml` into the PlacidCRM app repo at
   `.github/workflows/deploy-staging.yml`.
2. Create a **`staging` environment** in that repo
   (Settings → Environments → New environment → `staging`).
   Add a required reviewer there if you want deploys gated by approval — the
   workflow needs no change for that.
3. Add these **environment secrets** under that environment:

   | Secret | Value |
   |---|---|
   | `PROD_HOST` | the CRM droplet address (`$PROD_HOST` in `docs/DEPLOYMENT.md`) |
   | `STAGING_SSH_KEY` | contents of the `placid_connect_devbeta_ed25519` **private** key |
   | `SSH_KNOWN_HOSTS` | output of `ssh-keyscan <droplet address>` |

   Optionally add an environment **variable** `STAGING_URL` if staging ever
   moves off `https://staging.placidcrm.com`.

4. Run it: Actions → *Deploy to staging* → Run workflow → enter the ref
   (e.g. `fix/country-tax-and-marketing-ai`).

Nothing above puts a key or a host address in the repo or in a log. The host
is masked in the job output, and the key is written to a file on the runner
and discarded when the runner is destroyed.

## Why it calls the existing script

The workflow does **not** reimplement the guards from
`scripts/deploy-staging.sh`. It checks out the exact commit and runs that
script. There is then one deploy path, and the remote one cannot drift away
from the local one as the script is hardened further.

Two things are hoisted onto the runner because catching them before touching
the droplet is strictly cheaper:

- the migration `///` syntax guard (documented guard #5), and
- a post-deploy check that `/opt/placidcrm-staging/DEPLOYED_COMMIT` actually
  matches the commit that was checked out, which fails the job if it does not.

The dirty-tree guard is unnecessary here: a CI checkout is clean by
construction.

## What a run proves

The job fails rather than reporting a green deploy it cannot substantiate:

| Claim | How it is proved |
|---|---|
| Staging is serving the requested commit | `/opt/placidcrm-staging/DEPLOYED_COMMIT` on the droplet is compared to the SHA that was checked out; a mismatch fails the job |
| The artifact is genuinely new | container start time and Next `BUILD_ID` are printed from the running staging container |
| Production is untouched | production's `DEPLOYED_COMMIT` **and** `placidcrm-app-1` start time are snapshotted before the deploy and re-read after; any difference is a hard failure |
| Simon initiated it remotely | the run is `workflow_dispatch` from the Actions tab, so it works from a phone with no PC, no local Claude Code and no local SSH |

Exit codes are never trusted on their own — a 200 proves the old container is
alive, not that new code shipped.

## Production is untouched

The workflow is `workflow_dispatch` only — no push or schedule trigger — and
never invokes `deploy-production.sh`. `deploy-production.sh` keeps its own
rule that the commit must already be serving on staging, so the staging-first
order is still enforced by the script, not by this file.

## Assumptions to verify before the first run

This was written against `docs/DEPLOYMENT.md`, **not** against
`scripts/deploy-staging.sh` — that script was not readable from the session
that produced this. Check these three things and adjust if needed:

1. **How the script takes the host.** Assumed `$PROD_HOST` from the
   environment, per the `export PROD_HOST=…` instruction in the deployment
   doc. If it takes an argument or reads a config file instead, change the
   *Deploy to staging* step.
2. **The SSH key path.** Assumed the script uses
   `~/.ssh/placid_connect_devbeta_ed25519`, so the key is written to exactly
   that filename. If the path is configurable, prefer the config.
3. **Whether the script prompts.** Anything interactive (a confirmation, a
   password) will hang the job. It needs a non-interactive path — an env var
   or a `--yes` flag.

Also worth knowing: the build still happens on the droplet, so the 2GB RAM
limit and `NODE_OPTIONS=--max-old-space-size=3072` mitigation are unchanged by
this. Moving the build onto the runner would fix that properly, but it is a
larger change and would mean the remote path no longer matches the local one.
