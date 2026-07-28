#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PlacidCRM — deploy onto an EXISTING Ubuntu droplet.
#
# Run this ON the droplet (e.g. via DigitalOcean's web Console, as root):
#
#   curl -fsSL https://raw.githubusercontent.com/simonjohnston123/simonjohnston123/claude/placidcrm-saas-platform-trd4lf/deploy/deploy-on-droplet.sh | bash
#
# Idempotent: safe to re-run to update to the latest code.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO="https://github.com/simonjohnston123/simonjohnston123.git"
BRANCH="claude/placidcrm-saas-platform-trd4lf"
APP_DIR="/opt/placidcrm"
ACME_EMAIL_DEFAULT="simonjohnston123@gmail.com"

log() { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$*"; }

# --- heads-up if something already holds 80/443 (Caddy needs them) ----------
if command -v ss >/dev/null 2>&1; then
  if ss -ltn '( sport = :80 or sport = :443 )' 2>/dev/null | grep -q LISTEN; then
    warn "Something is already listening on port 80 and/or 443 on this droplet."
    warn "If the build fails to bind those ports, stop that service and re-run."
    ss -ltnp '( sport = :80 or sport = :443 )' 2>/dev/null || true
  fi
fi

# --- swap (protects the Next.js build from OOM on small droplets) -----------
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ]; then
  log "Adding 2G swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- Docker (with the compose plugin) ---------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# --- code -------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  log "Updating existing checkout in $APP_DIR"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  log "Cloning $BRANCH into $APP_DIR"
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# --- environment (.env) with generated secrets -----------------------------
if [ ! -f .env ]; then
  log "Generating .env with fresh secrets"
  AUTH_SECRET="$(openssl rand -base64 48)"
  POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')"
  cat > .env <<EOF
AUTH_SECRET=${AUTH_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
APP_URL=https://placidcrm.com
ROOT_DOMAIN=placidcrm.com
ACME_EMAIL=${ACME_EMAIL_DEFAULT}
EOF
  chmod 600 .env
else
  log ".env already present — keeping existing secrets"
fi

# --- build & launch (auto-HTTPS via Caddy) ----------------------------------
log "Building and starting PlacidCRM (this takes a few minutes)…"
docker compose -f docker-compose.prod.yml up -d --build

log "Waiting for the app to report healthy…"
ok=0
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 3
done

echo
if [ "$ok" = "1" ]; then
  log "PlacidCRM is up. Containers:"
  docker compose -f docker-compose.prod.yml ps
  cat <<'DONE'

──────────────────────────────────────────────────────────────
✅ Deployed. Next steps:

1. Point GoDaddy DNS for placidcrm.com at THIS droplet:
     A   @     168.144.160.107
     A   www   168.144.160.107
     A   *     168.144.160.107
   (Caddy will auto-issue the HTTPS certificate once DNS resolves here.)

2. Then open https://placidcrm.com/register to create your owner account.

Health check any time:  curl -s https://placidcrm.com/api/health
Logs:                   cd /opt/placidcrm && docker compose -f docker-compose.prod.yml logs -f app
──────────────────────────────────────────────────────────────
DONE
else
  warn "App did not report healthy yet. Check logs:"
  echo "  cd /opt/placidcrm && docker compose -f docker-compose.prod.yml logs app"
fi
