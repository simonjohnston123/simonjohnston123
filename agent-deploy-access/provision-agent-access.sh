#!/usr/bin/env bash
#
# Add a NAMED AGENT identity to the PlacidCRM droplet's deploy access.
#
# Companion to staging-deploy/provision-staging-ci-access.sh. That script
# builds the staging deploy user, the root-owned wrapper and the CI key.
# This one adds *additional* identities (Manus, a second Claude, a human
# on call) on top of it, each with its OWN verb allow-list, without
# touching the CI path.
#
# Run as root, ON THE DROPLET. Idempotent. --check changes nothing.
#
#   ./provision-agent-access.sh --check
#   ./provision-agent-access.sh --list
#   ./provision-agent-access.sh --identity manus-staging --pubkey /root/manus.pub
#   ./provision-agent-access.sh --identity gpt-staging   --pubkey /root/gpt.pub
#   ./provision-agent-access.sh --identity manus-staging --revoke
#
# NO PRIVATE KEY IS EVER HANDLED HERE. You supply a PUBLIC key that the
# agent generated and kept. The private half never leaves the agent, never
# lands on the droplet, and never appears in a chat log.
#
# WHY THIS EXISTS SEPARATELY: provision-staging-ci-access.sh writes
# authorized_keys with `>`. Re-running it would silently delete every other
# agent's key. Everything here is line-scoped by an identity marker in the
# key comment, so identities can be added, rotated and revoked one at a
# time and re-runs are additive.
#
set -euo pipefail

STAGING_USER="placid-staging-deploy"
RELEASE_USER="placid-prod-release"
STAGING_DIR="/opt/placidcrm-staging"
PROD_DIR="/opt/placidcrm"
CTL="/usr/local/sbin/staging-deploy-ctl"
RELEASE_CTL="/usr/local/sbin/prod-release-ctl"
GATE="/usr/local/sbin/agent-deploy-ssh"
ALLOW_DIR="/etc/placid-agent-access"
RELEASE_CONF="/etc/placid-prod-release"

# ---- Who gets access, and what a role means -------------------------------
# An identity is <agent>-<role>. Adding an agent is ONE WORD here; the roles
# below define what it may do. Deliberately not one allow-list per agent:
# duplicated lists drift, and a verb quietly appearing in one agent's list
# and not another's is exactly the drift nobody notices. Each agent still
# gets its own key and its own identity, so the auth log distinguishes them
# and access is revoked one agent at a time.
AGENTS="claude manus gpt"
ROLES="staging release"

# staging: exactly the set named in the access request — enough to fetch a
# sha, build it, bring it up and read back what is running. No
# migrate-deploy, no receive-archive, no record-deployment, so an identity
# holding this role cannot write to any database, production or otherwise.
ROLE_staging="fetch-checkout compose-build compose-up staging-status staging-migration-count"

# release: the separate production role. Everything here is read-only EXCEPT
# `release`, which is guarded and ships disabled. See prod-release-ctl below
# and README "The production guard".
ROLE_release="release release-preflight prod-deployed-commit prod-started-at prod-build-id prod-migration-count prod-http-status staging-deployed-commit"

IDENTITY=""; PUBKEY=""; CHECK_ONLY=0; REVOKE=0; LIST_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --check)    CHECK_ONLY=1; shift ;;
    --list)     LIST_ONLY=1; shift ;;
    --revoke)   REVOKE=1; shift ;;
    --identity) IDENTITY="${2:?--identity needs a value}"; shift 2 ;;
    --pubkey)   PUBKEY="${2:?--pubkey needs a path}"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done

say() { printf '  %s\n' "$*"; }
hdr() { printf '\n== %s\n' "$*"; }
die() { echo "REFUSING: $*" >&2; exit 1; }

identity_agent() { printf '%s' "${1%-*}"; }
identity_role()  { printf '%s' "${1##*-}"; }
in_list() { printf '%s' "$2" | tr ' ' '\n' | grep -qxF -- "$1"; }

# Which user does this identity live under? A release identity gets its own
# user so that a compromised staging key cannot reach the release path, and
# vice versa.
identity_user() {
  case "$(identity_role "$1")" in
    release) echo "$RELEASE_USER" ;;
    *)       echo "$STAGING_USER" ;;
  esac
}

# Empty for anything that is not <known-agent>-<known-role>. Both halves are
# checked against the registry, so a typo is refused rather than silently
# provisioned with an empty allow-list.
allow_for() {
  local agent role var
  agent="$(identity_agent "$1")"; role="$(identity_role "$1")"
  in_list "$agent" "$AGENTS" || return 0
  in_list "$role"  "$ROLES"  || return 0
  var="ROLE_${role}"
  printf '%s' "${!var:-}"
}

all_identities() {
  local a r
  for a in $AGENTS; do for r in $ROLES; do printf '%s ' "$a-$r"; done; done
}

# --------------------------------------------------------------------------
if [ "$LIST_ONLY" = 1 ]; then
  printf '%-18s %-22s %s\n' IDENTITY "SSH USER" "ALLOWED VERBS"
  for i in $(all_identities); do
    printf '%-18s %-22s %s\n' "$i" "$(identity_user "$i")" "$(allow_for "$i")"
  done
  exit 0
fi

# Everything past here touches the droplet.
[ "$(id -u)" -eq 0 ] || die "must run as root on the droplet"
command -v ssh-keygen >/dev/null || die "ssh-keygen not found"

if [ "$CHECK_ONLY" = 1 ]; then
  hdr "CHECK ONLY — nothing will be modified"
  for u in "$STAGING_USER" "$RELEASE_USER"; do
    if id "$u" >/dev/null 2>&1; then
      ak="/home/$u/.ssh/authorized_keys"
      say "user $u: exists"
      if [ -f "$ak" ]; then
        say "  authorized_keys: $(grep -c . "$ak" 2>/dev/null || echo 0) key line(s)"
        # THE POINT OF THIS WHOLE BLOCK: the fingerprints actually installed,
        # read from authorized_keys itself. A filename proves nothing.
        ssh-keygen -lf "$ak" 2>/dev/null | sed 's/^/    /' || say "    (no parsable keys)"
      else
        say "  authorized_keys: absent"
      fi
    else
      say "user $u: absent"
    fi
  done
  say "wrapper $CTL: $([ -f "$CTL" ] && echo present || echo ABSENT)"
  say "gate $GATE: $([ -f "$GATE" ] && echo present || echo absent)"
  say "release wrapper $RELEASE_CTL: $([ -f "$RELEASE_CTL" ] && echo present || echo absent)"
  say "release ENABLED: $([ -f "$RELEASE_CONF/allow-release" ] && echo YES || echo 'no (guarded verb refuses)')"
  [ -d "$ALLOW_DIR" ] && { say "allow-lists:"; for f in "$ALLOW_DIR"/*.allow; do
      [ -e "$f" ] || continue; say "  $(basename "$f" .allow): $(tr '\n' ' ' < "$f")"; done; }
  [ -d "$PROD_DIR" ] && say "prod dir owner: $(stat -c '%U:%G' "$PROD_DIR")"
  exit 0
fi

[ -n "$IDENTITY" ] || die "need --identity (e.g. manus-staging)"
ALLOW="$(allow_for "$IDENTITY")"
[ -n "$ALLOW" ] || die "unknown identity '$IDENTITY'. Valid: $(all_identities)"
# The identity is interpolated into the forced command and the key comment.
# Keep it to a shape that cannot carry a quote, a space or a shell character.
[[ "$IDENTITY" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]] || die "identity must match ^[a-z0-9][a-z0-9-]{1,40}$"

TARGET_USER="$(identity_user "$IDENTITY")"
HOME_SSH="/home/$TARGET_USER/.ssh"
AK="$HOME_SSH/authorized_keys"
MARKER="placid-agent-access=$IDENTITY"

# --------------------------------------------------------------------------
if [ "$REVOKE" = 1 ]; then
  hdr "Revoking $IDENTITY"
  [ -f "$AK" ] || die "$AK does not exist"
  before="$(grep -c . "$AK" || true)"
  # Anchored to END OF LINE. Unanchored, revoking "manus-staging" would
  # also strip "manus-staging-2" — one identity silently revoking another.
  tmp="$(mktemp)"; grep -v -- "${MARKER}$" "$AK" > "$tmp" || true
  install -m 600 -o "$TARGET_USER" -g "$TARGET_USER" "$tmp" "$AK"; rm -f "$tmp"
  after="$(grep -c . "$AK" || true)"
  say "removed $((before - after)) key line(s) for $IDENTITY"
  say "remaining fingerprints:"; ssh-keygen -lf "$AK" 2>/dev/null | sed 's/^/    /' || say "    (none)"
  exit 0
fi

[ -n "$PUBKEY" ] || die "need --pubkey /path/to/agent.pub (PUBLIC key only)"
[ -f "$PUBKEY" ] || die "$PUBKEY not found"

# --------------------------------------------------------------------------
hdr "1. Validate the supplied public key"
# Refuse anything that is not exactly one public key. A file with options
# already baked in, or several keys, would smuggle past the forced command.
[ "$(grep -c . "$PUBKEY")" -eq 1 ] || die "$PUBKEY must contain exactly one key line"
grep -qE '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp[0-9]+) ' "$PUBKEY" \
  || die "$PUBKEY does not start with a bare key type — strip any options"
if grep -qE 'PRIVATE KEY' "$PUBKEY"; then
  die "$PUBKEY looks like a PRIVATE key. Never place one on the droplet."
fi

FPR_LINE="$(ssh-keygen -lf "$PUBKEY")" || die "ssh-keygen cannot parse $PUBKEY"
BITS="$(awk '{print $1}' <<<"$FPR_LINE")"
FPR="$(awk '{print $2}' <<<"$FPR_LINE")"
KTYPE="$(awk '{print $NF}' <<<"$FPR_LINE" | tr -d '()')"
say "type $KTYPE, $BITS bits"
say "fingerprint $FPR"
case "$KTYPE" in
  ED25519) : ;;
  RSA) [ "$BITS" -ge 3072 ] || die "RSA key is $BITS bits; require >= 3072" ;;
  *) die "key type $KTYPE not accepted; use ed25519" ;;
esac

hdr "2. Users"
if ! id "$TARGET_USER" >/dev/null 2>&1; then
  if [ "$TARGET_USER" = "$STAGING_USER" ]; then
    die "$STAGING_USER absent — run staging-deploy/provision-staging-ci-access.sh first"
  fi
  useradd --system --create-home --shell /bin/bash "$TARGET_USER"
  say "created $TARGET_USER"
else
  say "$TARGET_USER already exists"
fi
# Docker group membership is root with extra steps. Same refusal as the
# staging script: `docker run -v /:/host` would reach $PROD_DIR.
if id -nG "$TARGET_USER" | tr ' ' '\n' | grep -qx docker; then
  die "$TARGET_USER is in the docker group, which is root-equivalent"
fi
if [ -d "$PROD_DIR" ] && [ "$(stat -c '%U' "$PROD_DIR")" = "$TARGET_USER" ]; then
  die "$PROD_DIR is owned by $TARGET_USER — that defeats the point"
fi

hdr "3. Allow-list for $IDENTITY"
install -d -m 755 -o root -g root "$ALLOW_DIR"
printf '%s\n' $ALLOW > "$ALLOW_DIR/$IDENTITY.allow"
chown root:root "$ALLOW_DIR/$IDENTITY.allow"; chmod 644 "$ALLOW_DIR/$IDENTITY.allow"
say "$(tr '\n' ' ' < "$ALLOW_DIR/$IDENTITY.allow")"

hdr "4. Per-identity SSH gate"
# One gate, many identities. The identity name is baked into the
# authorized_keys forced command, so it is chosen by whoever installed the
# key and can never be supplied by the client. SSH_ORIGINAL_COMMAND is
# matched as a literal against the identity's allow-list and is never
# evaluated as a shell string — `compose-up; id` is one unmatched literal,
# not two commands.
cat > "$GATE" <<'GATE'
#!/usr/bin/env bash
set -euo pipefail

IDENTITY="${1:?agent-deploy-ssh: no identity baked into authorized_keys}"
ALLOW_FILE="/etc/placid-agent-access/${IDENTITY}.allow"
CTL="/usr/local/sbin/staging-deploy-ctl"
RELEASE_CTL="/usr/local/sbin/prod-release-ctl"

[ -f "$ALLOW_FILE" ] || { echo "refused: no allow-list for '$IDENTITY'" >&2; exit 64; }

cmd="${SSH_ORIGINAL_COMMAND:-}"
verb="${cmd%% *}"
rest="${cmd#"$verb"}"; rest="${rest# }"

# Membership is an exact line match against the allow-list file. Not a
# glob, not a substring: `compose` must not admit `compose-up`.
#
# THE EXIT CODES ARE A CONTRACT, relied on by verify-agent-gate.sh:
#   64 = this verb is NOT on the allow-list (or is not a verb at all)
#   65 = the verb IS allowed, but the argument is wrong
# That gap lets the verifier prove a mutating verb such as compose-up is
# reachable WITHOUT ever executing it: probe it with a bad argument and a
# 65 says "you may run this", a 64 says "you may not". Do not collapse
# these two codes.
grep -qxF -- "$verb" "$ALLOW_FILE" || {
  echo "refused: '${cmd:-<login shell>}' not permitted for $IDENTITY" >&2; exit 64; }

# Which wrapper serves this identity. A staging key cannot reach the
# release wrapper even if a verb name were to collide, because the routing
# is by identity, not by verb.
case "$IDENTITY" in
  *-release) W="$RELEASE_CTL" ;;
  *)         W="$CTL" ;;
esac
[ -x "$W" ] || { echo "refused: wrapper $W not installed" >&2; exit 69; }

case "$verb" in
  # The only verbs that take caller data, and it is a sha in every case.
  # The wrapper re-asserts the shape; this is a first pass, not the check.
  fetch-checkout|release|release-preflight)
    [[ "$rest" =~ ^[0-9a-f]{40}$ ]] || { echo "refused: '$verb' needs a 40-char sha" >&2; exit 65; }
    exec sudo -n "$W" "$verb" "$rest" ;;
  *)
    [ -z "$rest" ] || { echo "refused: '$verb' takes no argument" >&2; exit 65; }
    exec sudo -n "$W" "$verb" ;;
esac
GATE
chown root:root "$GATE"; chmod 755 "$GATE"
say "wrote $GATE"

# --------------------------------------------------------------------------
hdr "5. Production release wrapper"
# Read-only verbs work immediately. `release` is guarded and ships OFF —
# it refuses until /etc/placid-prod-release/allow-release exists AND the
# sha has been approved out of band. Enabling it is a decision, not a step
# in getting a deploy to pass. Same idiom as record-deployment.
install -d -m 750 -o root -g root "$RELEASE_CONF"
[ -f "$RELEASE_CONF/approved-shas" ] || { : > "$RELEASE_CONF/approved-shas"; chmod 640 "$RELEASE_CONF/approved-shas"; }

cat > "$RELEASE_CTL" <<'RCTL'
#!/usr/bin/env bash
# Root-owned. The only thing placid-prod-release may sudo.
#
# Every verb but `release` is read-only and takes no argument: literal
# paths and a literal container name are baked in, so there is nothing to
# aim elsewhere.
set -euo pipefail

PROD_DIR="/opt/placidcrm"
STAGING_DIR="/opt/placidcrm-staging"
PROD_APP="placidcrm-app-1"
PROD_DB="placidcrm-db-1"
STAGING_APP="placidcrm-staging-app"
CONF="/etc/placid-prod-release"
BACKUP_DIR="/var/backups/placidcrm"
HEALTH_URL="https://placidcrm.com/"
COMPOSE="docker-compose.yml"

# Runs every production precondition and prints a verdict per line.
# Changes nothing. `release` calls it and refuses unless all pass.
preflight() {
  local sha="$1" bad=0
  chk() { if [ "$1" = ok ]; then printf '  ok    %s\n' "$2"; else printf '  FAIL  %s\n' "$2"; bad=1; fi; }

  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] && chk ok "sha is a 40-char commit id" || chk no "sha is a 40-char commit id"

  # 1. Approved out of band. A human (or a separate approval path) appends
  #    the sha to this file. The release identity cannot write it.
  grep -qxF -- "$sha" "$CONF/approved-shas" 2>/dev/null \
    && chk ok "sha is on the approved list" || chk no "sha is NOT approved (append it to $CONF/approved-shas)"

  # 2. Exact staging SHA. The release must be the thing staging exercised.
  local staged=""; [ -f "$STAGING_DIR/DEPLOYED_COMMIT" ] && staged="$(tr -d '[:space:]' < "$STAGING_DIR/DEPLOYED_COMMIT")"
  [ "$staged" = "$sha" ] && chk ok "matches staging DEPLOYED_COMMIT" \
    || chk no "staging is at '${staged:-<none>}', not $sha"

  # 3. Clean tree. Uncommitted drift in prod means the sha does not
  #    describe what would actually run.
  if [ -d "$PROD_DIR/.git" ]; then
    [ -z "$(git -C "$PROD_DIR" status --porcelain 2>/dev/null)" ] \
      && chk ok "production tree is clean" || chk no "production tree has uncommitted changes"
    git -C "$PROD_DIR" cat-file -e "${sha}^{commit}" 2>/dev/null \
      && chk ok "sha exists in the production checkout" || chk no "sha unknown to the production checkout (fetch first)"
  else
    chk no "$PROD_DIR is not a git checkout — cannot verify tree or sha"
  fi

  # 4. Migration parity: prod must not be behind what staging ran.
  local sm pm
  sm="$(docker exec "$STAGING_APP" sh -c "ls /app/prisma/migrations | grep -c '^[0-9]'" 2>/dev/null || echo x)"
  pm="$(docker exec "$PROD_APP"    sh -c "ls /app/prisma/migrations | grep -c '^[0-9]'" 2>/dev/null || echo y)"
  printf '  info  migrations staging=%s production=%s\n' "$sm" "$pm"

  # 5. Backup capability, checked BEFORE anything is touched.
  docker inspect "$PROD_DB" >/dev/null 2>&1 && chk ok "production database container is up" \
    || chk no "production database container $PROD_DB not found"

  # 6. The site is up NOW, so a later failure is attributable to this release.
  local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL" || echo 000)"
  [ "$code" = "200" ] && chk ok "public HTTPS health is 200 before release" \
    || chk no "public HTTPS health is $code before release"

  return $bad
}

case "${1:-}" in
  release-preflight)
    sha="${2:-}"; preflight "$sha"; exit $? ;;

  release)
    sha="${2:-}"
    [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "release: not a sha" >&2; exit 65; }
    [ -f "$CONF/allow-release" ] || {
      echo "release: refused — production release not enabled for agent identities." >&2
      echo "         Reconcile this wrapper with scripts/deploy-production.sh first," >&2
      echo "         then: touch $CONF/allow-release" >&2
      exit 67; }
    echo "== preflight"
    preflight "$sha" || { echo "release: refused — preflight failed, nothing was changed" >&2; exit 68; }

    echo "== database backup"
    install -d -m 700 -o root -g root "$BACKUP_DIR"
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    dump="$BACKUP_DIR/placidcrm-${stamp}-${sha:0:12}.sql.gz"
    docker exec "$PROD_DB" pg_dump -U placid -d placidcrm | gzip -c > "$dump"
    # A backup that is not verified is not a backup.
    [ -s "$dump" ] && gzip -t "$dump" || { echo "release: backup failed or is empty — aborting" >&2; rm -f "$dump"; exit 70; }
    echo "  backup $dump ($(stat -c %s "$dump") bytes)"

    prev="$(cat "$PROD_DIR/DEPLOYED_COMMIT" 2>/dev/null || echo '')"
    echo "  previous production sha: ${prev:-<unknown>}"

    echo "== checkout"
    git -C "$PROD_DIR" checkout -f --detach "$sha"
    actual="$(git -C "$PROD_DIR" rev-parse HEAD)"
    [ "$actual" = "$sha" ] || { echo "release: HEAD is $actual, expected $sha" >&2; exit 71; }

    echo "== build"
    if ! (cd "$PROD_DIR" && docker compose -f "$COMPOSE" build > /tmp/prod-build.log 2>&1); then
      tail -40 /tmp/prod-build.log
      echo "release: build failed — rolling tree back, nothing was deployed" >&2
      [ -n "$prev" ] && git -C "$PROD_DIR" checkout -f --detach "$prev"
      exit 72
    fi
    echo "  build ok"

    echo "== up"
    (cd "$PROD_DIR" && docker compose -f "$COMPOSE" up -d 2>&1 | tail -3)
    printf '%s' "$actual" > "$PROD_DIR/DEPLOYED_COMMIT"

    echo "== public HTTPS health"
    ok=0
    for _ in $(seq 1 30); do
      code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo 000)"
      [ "$code" = "200" ] && { ok=1; break; }
      sleep 5
    done
    if [ "$ok" != 1 ]; then
      echo "release: health check never returned 200 — ROLLING BACK to ${prev:-<unknown>}" >&2
      if [ -n "$prev" ]; then
        git -C "$PROD_DIR" checkout -f --detach "$prev"
        (cd "$PROD_DIR" && docker compose -f "$COMPOSE" up -d >/dev/null 2>&1) || true
        printf '%s' "$prev" > "$PROD_DIR/DEPLOYED_COMMIT"
      fi
      echo "restore the database from $dump if the schema moved" >&2
      exit 73
    fi
    echo "  200 OK"
    echo "$actual"
    ;;

  prod-deployed-commit)     exec cat "$PROD_DIR/DEPLOYED_COMMIT" ;;
  prod-started-at)          exec docker inspect -f '{{.State.StartedAt}}' "$PROD_APP" ;;
  prod-build-id)            exec docker exec "$PROD_APP" cat /app/.next/BUILD_ID ;;
  prod-migration-count)     exec docker exec "$PROD_APP" sh -c "ls /app/prisma/migrations | grep -c '^[0-9]'" ;;
  prod-http-status)         exec curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" ;;
  staging-deployed-commit)  exec cat "$STAGING_DIR/DEPLOYED_COMMIT" ;;

  *) echo "prod-release-ctl: refused verb '${1:-}'" >&2; exit 64 ;;
esac
RCTL
chown root:root "$RELEASE_CTL"; chmod 755 "$RELEASE_CTL"
say "wrote $RELEASE_CTL (release verb is DISABLED until $RELEASE_CONF/allow-release exists)"

hdr "6. sudoers for $TARGET_USER"
if [ "$TARGET_USER" = "$RELEASE_USER" ]; then
  cat > /etc/sudoers.d/placid-prod-release <<EOF
$RELEASE_USER ALL=(root) NOPASSWD: $RELEASE_CTL
Defaults:$RELEASE_USER !requiretty
EOF
  chmod 440 /etc/sudoers.d/placid-prod-release
  visudo -cf /etc/sudoers.d/placid-prod-release >/dev/null
  say "sudoers: $RELEASE_USER -> $RELEASE_CTL only"
else
  say "sudoers: already provided by provision-staging-ci-access.sh ($CTL)"
  [ -f /etc/sudoers.d/placid-staging-deploy ] || die "/etc/sudoers.d/placid-staging-deploy missing — run the staging script first"
fi

hdr "7. Install the key (additive)"
install -d -m 700 -o "$TARGET_USER" -g "$TARGET_USER" "$HOME_SSH"
[ -f "$AK" ] || { : > "$AK"; chown "$TARGET_USER":"$TARGET_USER" "$AK"; chmod 600 "$AK"; }
cp -a "$AK" "$AK.bak.$(date -u +%Y%m%dT%H%M%SZ)"

# Drop any previous line for THIS identity only, then append the new one.
# Every other identity's key, including the CI key, is untouched.
# Anchored, for the same reason as --revoke: an unanchored match would
# drop a longer identity name that merely starts with this one.
tmp="$(mktemp)"; grep -v -- "${MARKER}$" "$AK" > "$tmp" || true
printf 'restrict,command="%s %s" %s %s %s\n' \
  "$GATE" "$IDENTITY" \
  "$(awk '{print $1}' "$PUBKEY")" "$(awk '{print $2}' "$PUBKEY")" "$MARKER" >> "$tmp"
install -m 600 -o "$TARGET_USER" -g "$TARGET_USER" "$tmp" "$AK"; rm -f "$tmp"
say "installed under $TARGET_USER"

hdr "DONE — $IDENTITY"
cat <<EOF

  identity      $IDENTITY
  ssh user      $TARGET_USER
  fingerprint   $FPR
  allowed       $(tr '\n' ' ' < "$ALLOW_DIR/$IDENTITY.allow")

  Fingerprints now live in $AK (read back from the file, not assumed):
$(ssh-keygen -lf "$AK" 2>/dev/null | sed 's/^/    /')

  Give the agent ONLY: the username, the host, and the verb list. It
  already holds the private half; nothing secret leaves this droplet.

  Now prove the gate before trusting it:

    ./verify-agent-gate.sh <host> <agent-private-key> $IDENTITY

EOF
