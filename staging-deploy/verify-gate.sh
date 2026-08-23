#!/usr/bin/env bash
#
# Prove the staging CI gate actually restricts, before trusting it.
#
# Run from ANY machine that has the CI private key, against the droplet:
#   ./verify-gate.sh <droplet-host> <path-to-ci-key>
#
# THE REFUSALS RUN FIRST, ON PURPOSE. docs/TESTING.md makes the point
# better than this comment can: "any test whose pass condition is an empty
# list must also assert that the same machinery produces a NON-empty list."
# A gate that refuses everything — including a misconfigured one that is
# simply broken — would pass a suite that only checks refusals. So this
# asserts both directions, and the allow cases are what prove the refusals
# mean something.
#
set -uo pipefail

HOST="${1:?usage: verify-gate.sh <host> <key>}"
KEY="${2:?usage: verify-gate.sh <host> <key>}"
USER_NAME="${DEPLOY_USER:-placid-staging-deploy}"

pass=0; fail=0
SSH=(ssh -n -o BatchMode=yes -o StrictHostKeyChecking=yes -i "$KEY" "${USER_NAME}@${HOST}")

refuse() { # a command that MUST be rejected
  local desc="$1"; shift
  if "${SSH[@]}" "$@" >/dev/null 2>&1; then
    printf 'FAIL  %-52s was ALLOWED and must not be\n' "$desc"; fail=$((fail+1))
  else
    printf 'ok    %-52s refused\n' "$desc"; pass=$((pass+1))
  fi
}

allow() { # a command that MUST succeed and print something
  local desc="$1"; shift
  local out
  if out="$("${SSH[@]}" "$@" 2>/dev/null)" && [ -n "$out" ]; then
    printf 'ok    %-52s -> %s\n' "$desc" "$(printf '%s' "$out" | head -c 40)"; pass=$((pass+1))
  else
    printf 'FAIL  %-52s produced nothing\n' "$desc"; fail=$((fail+1))
  fi
}

echo "== Must be REFUSED =="
refuse "interactive login shell"            ""
refuse "arbitrary command"                  "id"
refuse "read the production env file"       "cat /opt/placidcrm/.env"
refuse "read the staging env file"          "cat /opt/placidcrm-staging/.env"
refuse "docker directly"                    "docker ps"
refuse "sudo to a shell"                    "sudo -n /bin/bash"
# The review point that prompted this file: a proof verb that accepts an
# argument is a verb that can be aimed somewhere else.
refuse "prod-started-at WITH an argument"   "prod-started-at placidcrm-staging-app"
refuse "prod-deployed-commit WITH a path"   "prod-deployed-commit /etc/shadow"
refuse "compose-up WITH an argument"        "compose-up --scale app=9"
refuse "receive-archive with a bad sha"     "receive-archive not-a-sha"
# The forgery case: a well-formed sha the archive does not back up. Sent with
# no archive on stdin, so it must fail at the commit-id check regardless.
refuse "receive-archive, sha with no archive" \
       "receive-archive 1111111111111111111111111111111111111111"
refuse "receive-archive with a path"        "receive-archive ../../etc"
refuse "production DB write (default off)"  "record-deployment 0000000000000000000000000000000000000000"
refuse "verb with a shell chain appended"   "deployed-commit; id"
refuse "compound verbs in one call"         "deployed-commit; echo; started-at"
refuse "unknown verb"                       "definitely-not-a-verb"

echo
echo "== Must be ALLOWED (these prove the refusals above are not just a broken gate) =="
allow  "deployed-commit"                    "deployed-commit"
allow  "started-at"                         "started-at"
allow  "build-id"                           "build-id"
allow  "prod-deployed-commit (no args)"     "prod-deployed-commit"
allow  "prod-started-at (no args)"          "prod-started-at"
allow  "prod-http-status (no args)"         "prod-http-status"
allow  "staging-status"                     "staging-status"
allow  "staging-migration-count"            "staging-migration-count"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || { echo "GATE IS NOT SAFE — do not add the secrets yet."; exit 1; }
echo "Gate verified: restricted where it must be, working where it must be."
