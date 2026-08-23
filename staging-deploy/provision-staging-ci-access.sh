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
INIT_GIT=0
for a in "$@"; do
  case "$a" in
    --check)    CHECK_ONLY=1 ;;
    --init-git) INIT_GIT=1 ;;
    *) echo "unknown option: $a" >&2; exit 64 ;;
  esac
done
DIR_GIT="$STAGING_DIR/.git"

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
  [ -d "$STAGING_DIR/.git" ] && say "staging is a git checkout: yes (fetch-checkout active)" \
                             || say "staging is a git checkout: no (still on deprecated receive-archive)"
  [ -f /etc/placid-staging-deploy/github_deploy_ed25519 ] && say "github deploy key: present" \
                                                          || say "github deploy key: absent"
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
#
# One verb per remote command in scripts/deploy-staging.sh. Every docker
# call lives HERE, because the deploy user is deliberately outside the
# docker group and `docker run -v /:/host` would reach /opt/placidcrm.
#
# bash, not sh: compose-build uses `set -o pipefail`.
set -euo pipefail

DIR="/opt/placidcrm-staging"
APP="placidcrm-staging-app"
COMPOSE="docker-compose.staging.yml"
GH_KEY="/etc/placid-staging-deploy/github_deploy_ed25519"

case "${1:-}" in
  # --- deploy-staging.sh step 1. Tar arrives on STDIN and must pass
  # through untouched. The SHA is the one piece of caller data any verb
  # accepts, and it is asserted to be exactly a commit hash first.
  # --- deploy-staging.sh step 1. Tar arrives on STDIN.
  #
  # The sha is read from the archive's pax global header rather than taken
  # as an argument. THIS IS NOT A BINDING, and must not be described as one:
  # the caller supplies the whole tar stream, header included, so anyone
  # holding this credential can put any sha in the header above any tree.
  # There is no object database here to check the pairing against.
  #
  # What it does buy: accidental disagreement is impossible, an archive
  # carrying no commit id is refused, and a caller that merely lies in an
  # argument is caught. Keep it — but see README "The production gate" for
  # what is actually required to bind sha to content.
  # DEPRECATED — superseded by fetch-checkout, which actually binds sha to
  # content. Kept only until the fetch model has completed a trial. Refuses
  # once $DIR is a git checkout, so the two paths can never both be live.
  receive-archive)
    test -d "$DIR/.git" && {
      echo "receive-archive: refused — $DIR is a git checkout, use fetch-checkout" >&2
      exit 71; }
    echo "receive-archive: DEPRECATED, use fetch-checkout" >&2
    claimed="${2:-}"
    tmp="$DIR/.deploy-tmp"
    arch="$(mktemp /tmp/staging-archive.XXXXXX)"
    trap 'rm -f "$arch"' EXIT
    cat > "$arch"

    # git archive may or may not be piped through gzip; normalise first.
    if [ "$(head -c2 "$arch" | od -An -tx1 | tr -d ' \n')" = "1f8b" ]; then
      gunzip -c "$arch" > "${arch}.tar" && mv "${arch}.tar" "$arch"
    fi

    sha=""
    if command -v git >/dev/null 2>&1; then
      sha="$(git get-tar-commit-id < "$arch" 2>/dev/null | tr -d '[:space:]' || true)"
    fi
    if [ -z "$sha" ]; then
      sha="$(dd if="$arch" bs=512 skip=1 count=1 2>/dev/null | tr -d '\000' \
             | sed -n 's/.*comment=\([0-9a-f]\{40\}\).*/\1/p')"
    fi
    [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || {
      echo "receive-archive: archive carries no commit id — refusing" >&2; exit 65; }

    # A caller may still state what it thinks it sent; it must agree.
    if [ -n "$claimed" ] && [ "$claimed" != "$sha" ]; then
      echo "receive-archive: caller claimed $claimed, archive is $sha" >&2; exit 65
    fi

    rm -rf "$tmp"; mkdir -p "$tmp"
    tar -xf "$arch" -C "$tmp"
    # Refuse to prune the live tree if the archive is not the app.
    test -d "$tmp/src/app" || { echo "archive missing src/app" >&2; exit 66; }
    rm -rf "$DIR"/{src,prisma,public,scripts}
    cp -a "$tmp"/. "$DIR"/
    rm -rf "$tmp"
    # Written LAST, and only from the derived value.
    printf '%s' "$sha" > "$DIR/DEPLOYED_COMMIT"
    echo "$sha"
    ;;

  # --- THE DEPLOY PATH. Git is content-addressed, so `git cat-file -e` on a
  # commit object proves that object IS that content. The caller names a sha
  # and cannot choose what it contains — which is the property receive-archive
  # could never provide, whether the sha arrived as an argument or in a tar
  # header. DEPLOYED_COMMIT is then written from `git rev-parse HEAD`, a value
  # produced by git after checkout rather than supplied by anyone.
  #
  # The GitHub deploy key lives at $GH_KEY, root-owned 600. The CI credential
  # cannot read it: it only ever reaches this verb through sudo.
  fetch-checkout)
    sha="${2:-}"
    [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "fetch-checkout: not a sha" >&2; exit 65; }
    test -d "$DIR/.git" || { echo "fetch-checkout: $DIR is not a git checkout — run --init-git" >&2; exit 68; }

    export GIT_SSH_COMMAND="ssh -i $GH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes"
    git -C "$DIR" fetch --no-tags --prune origin '+refs/heads/*:refs/remotes/origin/*'

    # The binding. Refuses a sha GitHub has never published.
    git -C "$DIR" cat-file -e "${sha}^{commit}" 2>/dev/null || {
      echo "fetch-checkout: $sha is not a commit in this repository" >&2; exit 69; }

    # -f discards tracked-file drift. Untracked files — .env, compose
    # overrides, Caddyfiles — are left alone, and nothing here runs git clean.
    git -C "$DIR" checkout -f --detach "$sha"

    actual="$(git -C "$DIR" rev-parse HEAD)"
    [ "$actual" = "$sha" ] || { echo "fetch-checkout: HEAD is $actual, expected $sha" >&2; exit 70; }
    printf '%s' "$actual" > "$DIR/DEPLOYED_COMMIT"
    echo "$actual"
    ;;

  compose-build)
    cd "$DIR"
    set -o pipefail
    docker compose -f "$COMPOSE" build > /tmp/staging-build-full.log 2>&1
    rc=$?
    tail -60 /tmp/staging-build-full.log
    exit $rc
    ;;

  compose-up)
    cd "$DIR"
    docker compose -f "$COMPOSE" up -d 2>&1 | tail -2
    ;;

  staging-status)
    cat "$DIR/DEPLOYED_COMMIT"
    docker inspect -f '{{.State.StartedAt}}' "$APP"
    docker exec "$APP" cat /app/.next/BUILD_ID
    docker inspect -f '{{.State.Status}}' "$APP"
    ;;

  staging-migration-count) exec docker exec "$APP" sh -c "ls /app/prisma/migrations | grep -c '^[0-9]'" ;;
  staging-build-id)        exec docker exec "$APP" cat /app/.next/BUILD_ID ;;
  migrate-status)          exec docker exec "$APP" npx prisma migrate status ;;
  migrate-deploy)          exec docker exec "$APP" npx prisma migrate deploy ;;

  # --- Proof verbs for the workflow. No arguments; literal paths and a
  # literal container name baked in, so there is nothing to aim elsewhere.
  deployed-commit)      exec cat "$DIR/DEPLOYED_COMMIT" ;;
  started-at)           exec docker inspect -f '{{.State.StartedAt}}' "$APP" ;;
  build-id)             exec docker exec "$APP" cat /app/.next/BUILD_ID ;;
  prod-deployed-commit) exec cat /opt/placidcrm/DEPLOYED_COMMIT ;;
  prod-started-at)      exec docker inspect -f '{{.State.StartedAt}}' placidcrm-app-1 ;;
  prod-http-status)     exec curl -s -o /dev/null -w '%{http_code}' https://placidcrm.com/ ;;

  # --- deploy-staging.sh step 8: a WRITE to the PRODUCTION database.
  # Refused by default. See README "The production write". Enabling this
  # is a deliberate decision, not a step in getting a deploy to pass.
  record-deployment)
    [ -f /etc/placid-staging-deploy/allow-prod-deployment-record ] || {
      echo "record-deployment: refused — production DB write not enabled for CI" >&2
      exit 67
    }
    sha="${2:-}"
    [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "record-deployment: not a sha" >&2; exit 65; }
    # Subject arrives on stdin and is bound as a psql variable, never
    # interpolated into the statement — a subject containing $$ would
    # otherwise break out of dollar-quoting.
    subject="$(head -c 500)"
    docker exec -i placidcrm-db-1 psql -U placid -d placidcrm \
      -v ON_ERROR_STOP=1 -v sha="$sha" -v subj="$subject" -v env=staging \
      -c 'INSERT INTO "Deployment" ("commitSha","environment","note","deployedAt")
          VALUES (:'"'"'sha'"'"', :'"'"'env'"'"', :'"'"'subj'"'"', now())'
    ;;

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
# Forced command for the CI key. Whatever the client asked for arrives in
# SSH_ORIGINAL_COMMAND and is matched here — never evaluated as a shell
# string, so `deployed-commit; id` is one unmatched literal, not two
# commands.
#
# STDIN IS NEVER READ HERE. receive-archive's tar must reach the wrapper
# untouched, so every branch uses exec.
set -euo pipefail
CTL="/usr/local/sbin/staging-deploy-ctl"

cmd="${SSH_ORIGINAL_COMMAND:-}"
verb="${cmd%% *}"
rest="${cmd#"$verb"}"; rest="${rest# }"

case "$verb" in
  # The two verbs that take the commit sha. The wrapper asserts its shape.
  fetch-checkout|receive-archive|record-deployment)
    exec sudo -n "$CTL" "$verb" "$rest" ;;

  # Everything else takes NO argument: reject if anything follows.
  deployed-commit|started-at|build-id|staging-status|staging-build-id| \
  staging-migration-count|migrate-status|migrate-deploy|compose-build| \
  compose-up|prod-deployed-commit|prod-started-at|prod-http-status)
    [ -z "$rest" ] || { echo "refused: '$verb' takes no argument" >&2; exit 64; }
    exec sudo -n "$CTL" "$verb" ;;

  *)
    echo "refused: '${cmd:-<login shell>}'" >&2
    exit 64 ;;
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
hdr "7. Convert staging to a git checkout (--init-git only)"
if [ "${INIT_GIT:-0}" = 1 ]; then
  GH_KEY_DIR=/etc/placid-staging-deploy
  GH_KEY="$GH_KEY_DIR/github_deploy_ed25519"
  install -d -m 700 -o root -g root "$GH_KEY_DIR"

  if [ ! -f "$GH_KEY" ]; then
    ssh-keygen -t ed25519 -N '' -C "placid-crm staging deploy (read-only)" -f "$GH_KEY" >/dev/null
    chown root:root "$GH_KEY" "${GH_KEY}.pub"; chmod 600 "$GH_KEY"; chmod 644 "${GH_KEY}.pub"
    say "generated GitHub deploy key"
    echo
    echo "  ADD THIS AS A READ-ONLY DEPLOY KEY on placidgroup/placid-crm"
    echo "  (Settings -> Deploy keys -> Add, leave 'Allow write access' UNCHECKED):"
    echo
    cat "${GH_KEY}.pub"
    echo
    echo "  Then re-run with --init-git to finish. Stopping here."
    exit 0
  fi

  # Pin github.com's host key for root, so StrictHostKeyChecking=yes works.
  install -d -m 700 /root/.ssh
  ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null
  sort -u /root/.ssh/known_hosts -o /root/.ssh/known_hosts

  export GIT_SSH_COMMAND="ssh -i $GH_KEY -o IdentitiesOnly=yes -o BatchMode=yes"
  if [ -d "$DIR_GIT" ]; then
    say "$STAGING_DIR is already a git checkout"
  else
    git -C "$STAGING_DIR" init -q
    git -C "$STAGING_DIR" remote add origin git@github.com:placidgroup/placid-crm.git 2>/dev/null || true
    git -C "$STAGING_DIR" fetch --no-tags --prune origin '+refs/heads/*:refs/remotes/origin/*'
    say "initialised and fetched"
    echo
    echo "  NOT checked out. The currently-deployed tree is untouched."
    echo "  The first fetch-checkout will move it, and that is the trial."
  fi
  # .env, compose overrides and Caddyfiles must survive a checkout -f.
  cat > "$STAGING_DIR/.git/info/exclude" <<'EXCL'
.env
.env.*
DEPLOYED_COMMIT
docker-compose.staging.yml
docker-compose.override.yml
Caddyfile
EXCL
  chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$STAGING_DIR/.git"
  say "local excludes written; .env and compose overrides will not be clobbered"
else
  say "skipped (pass --init-git to convert staging to a git checkout)"
fi

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
