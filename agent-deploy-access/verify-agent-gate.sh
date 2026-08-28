#!/usr/bin/env bash
#
# Prove an agent identity's access is exactly what it is supposed to be —
# before anyone relies on it.
#
#   ./verify-agent-gate.sh <host> <agent-private-key> <identity> [expected-fpr]
#
# Run from the machine that HOLDS the agent's private key (the agent's own
# machine). Nothing here prints private material.
#
# TWO THINGS THIS ASSERTS THAT A FILENAME CANNOT:
#
#   1. The key in this file is the key the droplet authorises. A file named
#      `manus_prod.pem` proves nothing about what is in authorized_keys.
#      Authentication succeeding with -o BatchMode=yes -o IdentitiesOnly=yes
#      does prove it: no agent, no password, no other identity can stand in.
#      With an expected fingerprint given, it is also compared literally.
#
#   2. The allow-list is the allow-list. Refusals run FIRST, because a gate
#      that refuses everything — including a broken one — would pass a suite
#      that only checked refusals. The allow cases are what make the
#      refusals mean something.
#
# NOTHING HERE MUTATES THE DEPLOYMENT. Verbs that would build, check out or
# ship are probed with a deliberately malformed sha, so the gate resolves
# them as allowed-but-invalid (exit 65) and they never reach the wrapper.
# A verb that is not on the allow-list exits 64. That gap is the test.
#
set -uo pipefail

HOST="${1:?usage: verify-agent-gate.sh <host> <key> <identity> [expected-fpr]}"
KEY="${2:?usage: verify-agent-gate.sh <host> <key> <identity> [expected-fpr]}"
IDENTITY="${3:?usage: verify-agent-gate.sh <host> <key> <identity> [expected-fpr]}"
EXPECT_FPR="${4:-}"

# The probe verbs must be ones THIS identity actually holds. Testing a
# shell chain with a verb the identity cannot run anyway would pass for the
# wrong reason — the gate would be rejecting the verb, not the chain.
case "$IDENTITY" in
  *-release)
    SSH_USER="${SSH_USER:-placid-prod-release}"
    NOARG_VERB="prod-http-status"; SHA_VERB="release-preflight" ;;
  *)
    SSH_USER="${SSH_USER:-placid-staging-deploy}"
    NOARG_VERB="staging-status";   SHA_VERB="fetch-checkout" ;;
esac

BAD_SHA="zzzz"                                            # never a valid sha
OK_SHAPE_SHA="1111111111111111111111111111111111111111"   # shaped, meaningless

pass=0; fail=0
SSH=(ssh -n -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
     -o ConnectTimeout=15 -i "$KEY" "${SSH_USER}@${HOST}")

run() { "${SSH[@]}" "$@" 2>/dev/null; }        # returns remote exit status
code_of() { "${SSH[@]}" "$@" >/dev/null 2>&1; printf '%s' "$?"; }

refuse() { local d="$1"; shift
  if run "$@" >/dev/null 2>&1; then printf 'FAIL  %-50s ALLOWED and must not be\n' "$d"; fail=$((fail+1))
  else printf 'ok    %-50s refused\n' "$d"; pass=$((pass+1)); fi; }

allow() { local d="$1"; shift; local out
  if out="$(run "$@")" && [ -n "$out" ]; then
    printf 'ok    %-50s -> %s\n' "$d" "$(printf '%s' "$out" | head -c 32 | tr '\n' ' ')"; pass=$((pass+1))
  else printf 'FAIL  %-50s produced nothing\n' "$d"; fail=$((fail+1)); fi; }

# On the allow-list, but not executed: the gate rejects the argument shape
# (65) instead of rejecting the verb (64).
reachable() { local d="$1" verb="$2" c
  c="$(code_of "$verb $BAD_SHA")"
  if [ "$c" = 65 ]; then printf 'ok    %-50s on allow-list (not executed)\n' "$d"; pass=$((pass+1))
  elif [ "$c" = 64 ]; then printf 'FAIL  %-50s NOT on allow-list\n' "$d"; fail=$((fail+1))
  else printf 'FAIL  %-50s unexpected exit %s\n' "$d" "$c"; fail=$((fail+1)); fi; }

not_allowed() { local d="$1" verb="$2" c
  c="$(code_of "$verb")"
  if [ "$c" = 64 ]; then printf 'ok    %-50s not on allow-list\n' "$d"; pass=$((pass+1))
  else printf 'FAIL  %-50s exit %s, expected 64\n' "$d" "$c"; fail=$((fail+1)); fi; }

# --------------------------------------------------------------------------
echo "== Key identity"
[ -f "$KEY" ] || { echo "FAIL  no such key file: $KEY"; exit 1; }
perm="$(stat -c '%a' "$KEY" 2>/dev/null || stat -f '%Lp' "$KEY")"
case "$perm" in 400|600) printf 'ok    %-50s mode %s\n' "private key permissions" "$perm"; pass=$((pass+1)) ;;
  *) printf 'FAIL  %-50s mode %s (must be 600)\n' "private key permissions" "$perm"; fail=$((fail+1)) ;; esac

FPR="$(ssh-keygen -lf "$KEY" 2>/dev/null | awk '{print $2}')"
[ -n "$FPR" ] || { echo "FAIL  cannot fingerprint $KEY"; exit 1; }
printf '      fingerprint %s\n' "$FPR"
if [ -n "$EXPECT_FPR" ]; then
  if [ "$FPR" = "$EXPECT_FPR" ]; then printf 'ok    %-50s matches expected\n' "fingerprint"; pass=$((pass+1))
  else printf 'FAIL  %-50s expected %s\n' "fingerprint" "$EXPECT_FPR"; fail=$((fail+1)); fi
fi

# The real binding: does the droplet authorise THIS key, with no fallback?
echo
echo "== Authentication (proves authorized_keys holds this exact key)"
auth_code="$(code_of "definitely-not-a-verb")"
if [ "$auth_code" = 255 ]; then
  echo "FAIL  authentication or connection failed — key is NOT authorised (or host/user wrong)"
  echo "      user=$SSH_USER host=$HOST identity=$IDENTITY"
  exit 1
fi
printf 'ok    %-50s authenticated, forced command active\n' "$SSH_USER@$HOST"; pass=$((pass+1))

echo
echo "== Must be REFUSED"
refuse "interactive login shell"              ""
refuse "arbitrary command"                    "id"
refuse "read the production env file"         "cat /opt/placidcrm/.env"
refuse "read the staging env file"            "cat /opt/placidcrm-staging/.env"
refuse "docker directly"                      "docker ps"
refuse "sudo to a shell"                      "sudo -n /bin/bash"
refuse "unknown verb"                         "definitely-not-a-verb"
refuse "verb with a shell chain appended"     "$NOARG_VERB; id"
refuse "compound verbs in one call"           "$NOARG_VERB; echo; $NOARG_VERB"
refuse "no-argument verb given an argument"   "$NOARG_VERB --all"
refuse "sha-taking verb with a path"          "$SHA_VERB ../../etc"
refuse "sha-taking verb with a command"       "$SHA_VERB \$(id)"

case "$IDENTITY" in
  *-staging)
    # A staging identity must not reach any database write or the release path.
    not_allowed "migrate-deploy (DB write)"       "migrate-deploy"
    not_allowed "record-deployment (prod DB write)" "record-deployment"
    not_allowed "receive-archive (unbound sha)"   "receive-archive"
    not_allowed "release (production)"            "release"
    echo
    echo "== Must be ALLOWED"
    reachable "fetch-checkout"                    "fetch-checkout"
    reachable "compose-build"                     "compose-build"
    reachable "compose-up"                        "compose-up"
    allow     "staging-status"                    "staging-status"
    allow     "staging-migration-count"           "staging-migration-count"
    ;;
  *-release)
    not_allowed "compose-up (staging path)"       "compose-up"
    not_allowed "fetch-checkout (staging path)"   "fetch-checkout"
    not_allowed "migrate-deploy"                  "migrate-deploy"
    echo
    echo "== Must be ALLOWED (read-only)"
    allow     "prod-deployed-commit"              "prod-deployed-commit"
    allow     "prod-started-at"                   "prod-started-at"
    allow     "prod-build-id"                     "prod-build-id"
    allow     "prod-migration-count"              "prod-migration-count"
    allow     "prod-http-status"                  "prod-http-status"
    allow     "staging-deployed-commit"           "staging-deployed-commit"
    echo
    echo "== Guarded release verb"
    reachable "release is on the allow-list"      "release"
    reachable "release-preflight"                 "release-preflight"
    # 67 = shipped disabled. 68 = enabled but preflight refused this sha.
    # Either is a correct answer for a sha nobody approved; 0 is not.
    c="$(code_of "release $OK_SHAPE_SHA")"
    case "$c" in
      67) printf 'ok    %-50s disabled at the droplet (exit 67)\n' "unapproved sha"; pass=$((pass+1)) ;;
      68) printf 'ok    %-50s enabled, preflight refused it (exit 68)\n' "unapproved sha"; pass=$((pass+1)) ;;
      0)  printf 'FAIL  %-50s AN UNAPPROVED SHA WAS RELEASED\n' "unapproved sha"; fail=$((fail+1)) ;;
      *)  printf 'ok    %-50s refused (exit %s)\n' "unapproved sha" "$c"; pass=$((pass+1)) ;;
    esac
    ;;
esac

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || { echo "GATE IS NOT SAFE — do not hand this identity out yet."; exit 1; }
echo "Verified: $IDENTITY ($SSH_USER@$HOST) is restricted where it must be"
echo "and working where it must be. Fingerprint $FPR."
