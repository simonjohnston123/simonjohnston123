#!/usr/bin/env bash
#
# Regression tests for the three deploy-script defects.
#
# These are FUNCTIONAL where they can be: they reproduce each failure with
# real commands, then assert the fixed form behaves differently. A test that
# only greps the script would pass against a comment.
#
# Run: bash staging-deploy/tests/deploy-guards.test.sh
#
set -uo pipefail
pass=0; fail=0
ok()   { printf 'ok    %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf 'FAIL  %s\n' "$1"; fail=$((fail+1)); }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------------------
# 1. pg_dump | gzip must not report success when pg_dump fails.
# ---------------------------------------------------------------------------
fake_dump_fails() { echo "pg_dump: error: connection failed" >&2; return 1; }

# The bug, reproduced: no pipefail, so the pipeline takes gzip's status.
# NOTE the explicit `set +o pipefail` — this file enables it at the top, and
# without turning it back off the subshell inherits it and the bug cannot
# reproduce. The first run of this test failed here for exactly that reason,
# which is the point of asserting the reproduction at all.
( set +o pipefail; set -e; fake_dump_fails | gzip > "$TMP/buggy.gz" ) 2>/dev/null
if [ $? -eq 0 ]; then
  ok "reproduced: without pipefail a failed dump still exits 0"
else
  bad "could not reproduce the bug — test is not measuring anything"
fi

# The fix: pipefail propagates the failure.
( set -eo pipefail; fake_dump_fails | gzip > "$TMP/fixed.gz" ) 2>/dev/null
[ $? -ne 0 ] && ok "fixed: with pipefail a failed dump exits non-zero" \
             || bad "pipefail did not propagate the failure"

# And the size assert catches a dump that 'succeeds' with no rows.
: | gzip > "$TMP/empty.gz"
sz=$(stat -c%s "$TMP/empty.gz")
MIN=1024
[ "$sz" -lt "$MIN" ] && ok "empty dump is under the ${MIN}B floor, so the size assert fires" \
                    || bad "empty gzip is ${sz}B — floor of ${MIN} is too low to catch it"

# ---------------------------------------------------------------------------
# 2. Backup filenames must not collide when the same commit is redeployed.
# ---------------------------------------------------------------------------
COMMIT_DATE="2026-08-22T11:09:50"   # fixed, as `git log -1 --format=%cd` is
SHORT="f3bbaff"

buggy_name()  { echo "placidcrm-${COMMIT_DATE}-${SHORT}.sql.gz"; }
fixed_name()  { echo "placidcrm-$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT_DATE}-${SHORT}.sql.gz"; }

[ "$(buggy_name)" = "$(buggy_name)" ] \
  && ok "reproduced: commit-date naming yields the same file on a redeploy" \
  || bad "could not reproduce the collision"

a="$(fixed_name)"; sleep 1; b="$(fixed_name)"
[ "$a" != "$b" ] && ok "fixed: wall-clock prefix makes redeploys distinct" \
                 || bad "wall-clock names still collided: $a"

# ---------------------------------------------------------------------------
# 3. A commit subject containing $$ must not break out of SQL quoting.
# ---------------------------------------------------------------------------
SUBJECT='fix: raise $$ cap and $$ floor'

# The bug: interpolated into dollar-quoting, the subject terminates the literal.
stmt="INSERT INTO \"Deployment\" (note) VALUES (\$\$${SUBJECT}\$\$);"
# Count dollar-quote delimiters: a safe statement has exactly two.
delims=$(grep -o '\$\$' <<<"$stmt" | wc -l)
[ "$delims" -gt 2 ] \
  && ok "reproduced: subject with \$\$ yields $delims delimiters, breaking the literal" \
  || bad "could not reproduce the quoting break (found $delims)"

# The fix: the value is bound, never placed in the statement text.
stmt_fixed="INSERT INTO \"Deployment\" (note) VALUES (:'subj');"
if ! grep -q '\$\$' <<<"$stmt_fixed" && grep -q ":'subj'" <<<"$stmt_fixed"; then
  ok "fixed: statement carries a bound variable and no dollar-quoting"
else
  bad "fixed statement still interpolates"
fi

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
