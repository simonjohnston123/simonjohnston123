#!/usr/bin/env bash
#
# Provision a STAGING-ONLY deploy identity for CI on the PlacidCRM droplet.
#
# Run ONCE, as root, ON THE DROPLET. Idempotent — safe to re-run.
# Run with --check first: it inspects and changes nothing.
#
# Replaces "put a root key for the production droplet into a GitHub secret"
# with an identity that can only touch /opt/placidcrm-staging.
#
# Three layers, because any one of them alone is bypassable:
#   1. A non-root user that owns only the staging directory.
#   2. An SSH forced command — the key cannot run arbitrary commands, only
#      the verbs in the dispatcher below.
#   3. sudo scoped to ONE root-owned wrapper with a fixed verb list, never
#      to `docker` directly.
#
# WHY NOT THE DOCKER GROUP: adding the user to `docker` would be root with
# extra steps — `docker run -v /:/host` mounts the whole filesystem, which
# reaches /opt/placidcrm. The wrapper exists precisely so the docker socket
# is never exposed to this user.
#
set -euo pipefail

DEPLOY_USER="placid-staging-deploy"
STAGING_DIR="/opt/placidcrm-staging"
PROD_DIR="/opt/placidcrm"
STAGING_CONTAINER="placidcrm-staging-app"
CTL="/usr/local/sbin/staging-deploy-ctl"
SSHGATE="/usr/local/sbin/staging-deploy-ssh"
KEY_OUT="/root/staging-ci-${DEPLOY_USER}.key"

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

say() { printf '  %s\n' "$*"; }
hdr() { printf '\n== %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "must run as root on the droplet" >&2; exit 1; }
[ -d "$STAGING_DIR" ] || { echo "no $STAGING_DIR here — wrong host?" >&2; exit 1; }

if [ "$CHECK_ONLY" = 1 ]; then
  hdr "CHECK ONLY — nothing will be modified"
  id "$DEPLOY_USER" >/dev/null 2>&1 && say "user $DEPLOY_USER: exists" || say "user $DEPLOY_USER: absent"
  [ -f "$CTL" ] && say "wrapper $CTL: present" || say "wrapper $CTL: absent"
  [ -f "$SSHGATE" ] && say "ssh gate $SSHGATE: present" || say "ssh gate $SSHGATE: absent"
  [ -f /etc/sudoers.d/placid-staging-deploy ] && say "sudoers: present" || say "sudoers: absent"
  say "staging dir owner: $(stat -c '%U:%G' "$STAGING_DIR")"
  [ -d "$PROD_DIR" ] && say "prod dir owner:    $(stat -c '%U:%G' "$PROD_DIR") (must NOT be $DEPLOY_USER)"
  exit 0
fi

# --------------------------------------------------------------------------
hdr "1. Deploy user"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  say "$DEPLOY_USER already exists — leaving it alone"
else
  useradd --system --create-home --shell /bin/bash "$DEPLOY_USER"
  say "created $DEPLOY_USER"
fi
# Explicitly NOT added to the docker group. See the note at the top.
if id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker; then
  echo "REFUSING: $DEPLOY_USER is in the docker group, which is root-equivalent." >&2
  echo "Remove it (gpasswd -d $DEPLOY_USER docker) and re-run." >&2
  exit 1
fi

hdr "2. Staging directory ownership"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$STAGING_DIR"
chmod 750 "$STAGING_DIR"
say "$STAGING_DIR -> $DEPLOY_USER (750)"
# The staging .env holds the staging DB password; keep it readable only by the user.
[ -f "$STAGING_DIR/.env" ] && chmod 640 "$STAGING_DIR/.env" && say "tightened $STAGING_DIR/.env to 640"

if [ -d "$PROD_DIR" ]; then
  owner="$(stat -c '%U' "$PROD_DIR")"
  if [ "$owner" = "$DEPLOY_USER" ]; then
    echo "REFUSING: $PROD_DIR is owned by $DEPLOY_USER. That defeats the point." >&2
    exit 1
  fi
  say "$PROD_DIR owned by $owner — untouched, as intended"
fi

# --------------------------------------------------------------------------
hdr "3. Root-owned control wrapper (the only sudo entry point)"
cat > "$CTL" <<'WRAPPER'
#!/usr/bin/env bash
# Root-owned. The ONLY thing placid-staging-deploy may sudo.
# Every verb is hardcoded against the staging container and staging dir.
# No verb takes a path, an image or a container name from the caller.
set -euo pipefail

STAGING_DIR="/opt/placidcrm-staging"
STAGING_CONTAINER="placidcrm-staging-app"

case "${1:-}" in
  compose-build)   exec docker compose --project-directory "$STAGING_DIR" build ;;
  compose-up)      exec docker compose --project-directory "$STAGING_DIR" up -d ;;
  compose-ps)      exec docker compose --project-directory "$STAGING_DIR" ps ;;
  started-at)      exec docker inspect -f '{{.State.StartedAt}}' "$STAGING_CONTAINER" ;;
  build-id)        exec docker exec "$STAGING_CONTAINER" cat /app/.next/BUILD_ID ;;
  migrate-status)  exec docker exec "$STAGING_CONTAINER" npx prisma migrate status ;;
  migrate-deploy)  exec docker exec "$STAGING_CONTAINER" npx prisma migrate deploy ;;

  # Production PROOF verbs. Literal paths and a literal container name, both
  # baked in here. They take no argument, so there is nothing to point
  # elsewhere. This is the only production contact in the entire path.
  prod-deployed-commit) exec cat /opt/placidcrm/DEPLOYED_COMMIT ;;
  prod-started-at)      exec docker inspect -f '{{.State.StartedAt}}' placidcrm-app-1 ;;
  *)
    echo "staging-deploy-ctl: refused verb '${1:-}'" >&2
    exit 64
    ;;
esac
WRAPPER
chown root:root "$CTL"; chmod 755 "$CTL"
say "wrote $CTL"

hdr "4. sudoers — one wrapper, no wildcards, no docker"
cat > /etc/sudoers.d/placid-staging-deploy <<EOF
# $DEPLOY_USER may run exactly one root-owned program, which itself
# accepts only a fixed verb list. It may NOT run docker directly.
$DEPLOY_USER ALL=(root) NOPASSWD: $CTL
Defaults:$DEPLOY_USER !requiretty
EOF
chmod 440 /etc/sudoers.d/placid-staging-deploy
visudo -cf /etc/sudoers.d/placid-staging-deploy >/dev/null
say "sudoers installed and validated"

# --------------------------------------------------------------------------
hdr "5. SSH forced command"
cat > "$SSHGATE" <<'GATE'
#!/usr/bin/env bash
# Forced command for the CI key. The key cannot run anything else:
# whatever the client asked for arrives in SSH_ORIGINAL_COMMAND and is
# matched against this list, never evaluated as a shell string.
set -euo pipefail

CTL="/usr/local/sbin/staging-deploy-ctl"
STAGING_DIR="/opt/placidcrm-staging"

case "${SSH_ORIGINAL_COMMAND:-}" in
  # Proofs the workflow needs. Read-only.
  "deployed-commit")      exec cat "$STAGING_DIR/DEPLOYED_COMMIT" ;;
  "started-at")           exec sudo -n "$CTL" started-at ;;
  "build-id")             exec sudo -n "$CTL" build-id ;;
  "migrate-status")       exec sudo -n "$CTL" migrate-status ;;

  # Production PROOF ONLY — reads two facts, changes nothing. This is how
  # the workflow shows production did not move; it is not a way in.
  "prod-deployed-commit") exec sudo -n "$CTL" prod-deployed-commit ;;
  "prod-started-at")      exec sudo -n "$CTL" prod-started-at ;;

  # Deploy verbs.
  "compose-build")        exec sudo -n "$CTL" compose-build ;;
  "compose-up")           exec sudo -n "$CTL" compose-up ;;
  "migrate-deploy")       exec sudo -n "$CTL" migrate-deploy ;;

  # Receiving the code tarball on stdin, unpacked into staging only.
  "receive-archive")      exec tar -xzf - -C "$STAGING_DIR" ;;

  *)
    echo "refused: '${SSH_ORIGINAL_COMMAND:-<login shell>}'" >&2
    exit 64
    ;;
esac
GATE
chown root:root "$SSHGATE"; chmod 755 "$SSHGATE"
say "wrote $SSHGATE"

hdr "6. CI keypair"
HOME_SSH="/home/$DEPLOY_USER/.ssh"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$HOME_SSH"
if [ -f "$KEY_OUT" ]; then
  say "key already generated at $KEY_OUT — not regenerating"
else
  ssh-keygen -t ed25519 -N '' -C "github-actions-staging-only" -f "$KEY_OUT" >/dev/null
  say "generated $KEY_OUT"
fi
# restrict: no port forwarding, no agent forwarding, no pty, no X11.
printf 'restrict,command="%s" %s\n' "$SSHGATE" "$(cat "${KEY_OUT}.pub")" > "$HOME_SSH/authorized_keys"
chown "$DEPLOY_USER":"$DEPLOY_USER" "$HOME_SSH/authorized_keys"
chmod 600 "$HOME_SSH/authorized_keys"
say "authorized_keys pinned to the forced command"

# --------------------------------------------------------------------------
hdr "DONE — GitHub secrets to create (staging environment)"
cat <<EOF

  STAGING_SSH_USER   $DEPLOY_USER
  PROD_HOST          <this droplet's address>
  STAGING_SSH_KEY    the contents of $KEY_OUT
  SSH_KNOWN_HOSTS    run: ssh-keyscan <this droplet's address>

Then DELETE the private key from the droplet:

  shred -u $KEY_OUT

Verify the restriction actually holds before trusting it:

  ssh -i $KEY_OUT $DEPLOY_USER@<host> 'cat /opt/placidcrm/.env'   # must be refused
  ssh -i $KEY_OUT $DEPLOY_USER@<host> deployed-commit             # must print a sha

A check that cannot fail is not a check — run the refusal case first.
EOF
