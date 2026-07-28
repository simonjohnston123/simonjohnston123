#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Create a NEW DigitalOcean droplet that auto-deploys PlacidCRM.
#
# Run this on a machine that has the `doctl` CLI installed and authenticated
# (i.e. where your DigitalOcean access lives — e.g. Zoe's PC), NOT inside the
# network-restricted Claude sandbox.
#
#   1. Install doctl:  https://docs.digitalocean.com/reference/doctl/how-to/install/
#   2. Authenticate:   doctl auth init      (paste a DO API token)
#   3. From the repo root, run:  bash deploy/create-droplet.sh
#
# It creates a fresh, isolated droplet (does NOT touch placid-connect-devbeta)
# and uses deploy/cloud-init.yaml to install Docker + PlacidCRM automatically.
# ---------------------------------------------------------------------------
set -euo pipefail

NAME="${NAME:-placidcrm}"
REGION="${REGION:-syd1}"          # Sydney; see `doctl compute region list`
SIZE="${SIZE:-s-1vcpu-2gb}"       # 2 GB RAM (needed for the Next.js build)
IMAGE="${IMAGE:-ubuntu-24-04-x64}"
SSH_KEYS="${SSH_KEYS:-}"          # optional: comma-separated DO SSH key IDs/fingerprints
CLOUD_INIT="deploy/cloud-init.yaml"

command -v doctl >/dev/null 2>&1 || { echo "doctl not found — install it first (see header)."; exit 1; }
[ -f "$CLOUD_INIT" ] || { echo "Run this from the repo root; $CLOUD_INIT not found."; exit 1; }

# Confirm auth works and surface which account we're about to bill.
echo "→ DigitalOcean account:"
doctl account get --format Email,Status --no-header || { echo "doctl not authenticated — run: doctl auth init"; exit 1; }

# Auto-attach all SSH keys on the account if none specified, so you can log in later.
if [ -z "$SSH_KEYS" ]; then
  SSH_KEYS="$(doctl compute ssh-key list --format ID --no-header 2>/dev/null | paste -sd, - || true)"
fi

echo "→ Creating droplet '$NAME' ($SIZE, $IMAGE, $REGION)…"
doctl compute droplet create "$NAME" \
  --region "$REGION" \
  --size "$SIZE" \
  --image "$IMAGE" \
  ${SSH_KEYS:+--ssh-keys "$SSH_KEYS"} \
  --user-data-file "$CLOUD_INIT" \
  --wait \
  --format ID,Name,PublicIPv4,Region,Status

IP="$(doctl compute droplet list "$NAME" --format PublicIPv4 --no-header | head -1)"

cat <<DONE

──────────────────────────────────────────────────────────────
✅ Droplet '$NAME' created with public IP:  ${IP:-<check dashboard>}

It is now installing Docker and building PlacidCRM (3–6 min). Watch with:
  ssh root@${IP}  then:  tail -f /var/log/cloud-init-output.log

Next: point GoDaddy DNS for placidcrm.com at THIS new droplet:
  A  @    ${IP}
  A  www  ${IP}
  A  *    ${IP}

Then open https://placidcrm.com/register
──────────────────────────────────────────────────────────────
DONE
