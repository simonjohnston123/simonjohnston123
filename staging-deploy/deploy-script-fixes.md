# Patches for `scripts/deploy-staging.sh` and `scripts/deploy-production.sh`

Exact changes for a session with repo access. Each is verified by
`staging-deploy/tests/deploy-guards.test.sh`, which reproduces the defect
before asserting the fix — run it before and after.

Apply **1 and 3 to both scripts.** Only `deploy-production.sh` takes the
backup, so 2 is production-only.

---

## 1. `pipefail` on the backup, plus a size floor

`pg_dump | gzip > file` in a remote shell with no `pipefail` takes gzip's exit
status. A failed dump writes a valid, near-empty archive, the remote command
returns 0, and the deploy proceeds — in the one step that promises
recoverability.

```diff
-docker exec placidcrm-db-1 pg_dump -U placid placidcrm | gzip > "$BACKUP"
-ls -lh "$BACKUP"
+set -o pipefail
+docker exec placidcrm-db-1 pg_dump -U placid placidcrm | gzip > "$BACKUP" || {
+  echo "pre-deploy backup FAILED — refusing to deploy" >&2; exit 1; }
+# A dump that "succeeds" with nothing in it is the same outcome as no backup.
+SZ=$(stat -c%s "$BACKUP")
+[ "$SZ" -ge 1048576 ] || { echo "backup is only ${SZ}B — refusing" >&2; exit 1; }
+ls -lh "$BACKUP"
```

Set the floor from a known-good dump; 1 MiB is a placeholder, not a
measurement. `ls -lh` printing a size is not an assertion.

## 2. Collision-safe backup filenames (production only)

`STAMP` comes from `git log -1 --format=%cd`, so redeploying a commit
overwrites the previous run's pre-deploy dump — the file rollback option 3 in
`DEPLOYMENT.md` assumes is the state before you touched anything.

```diff
-STAMP="$(git log -1 --format=%cd --date=format:%Y%m%dT%H%M%S)"
-BACKUP="/opt/backups/predeploy/placidcrm-$STAMP-$SHORT.sql.gz"
+STAMP="$(git log -1 --format=%cd --date=format:%Y%m%dT%H%M%S)"
+RUN_AT="$(date -u +%Y%m%dT%H%M%SZ)"     # wall-clock: distinct per RUN
+BACKUP="/opt/backups/predeploy/placidcrm-$RUN_AT-$STAMP-$SHORT.sql.gz"
```

Wall-clock first so the directory sorts by when the backup was taken, which is
what you want when reaching for one.

## 3. Bind the commit subject instead of interpolating it

Both scripts build the `Deployment` insert with `$$…$$` dollar-quoting around
the commit subject. A subject containing `$$` closes the literal early.

```diff
-psql -U placid -d placidcrm -v ON_ERROR_STOP=1 <<SQL
-INSERT INTO "Deployment" ("commitSha","environment","note","deployedAt")
-VALUES ('$SHA', '$ENV', $$$SUBJECT$$, now());
-SQL
+psql -U placid -d placidcrm -v ON_ERROR_STOP=1 \
+  -v sha="$SHA" -v env="$ENV" -v subj="$SUBJECT" \
+  -c 'INSERT INTO "Deployment" ("commitSha","environment","note","deployedAt")
+      VALUES (:'"'"'sha'"'"', :'"'"'env'"'"', :'"'"'subj'"'"', now())'
```

`:'var'` is psql's quoted-variable form: the value is escaped by psql and never
becomes statement text.

## 4. Production asserts less than staging (not a patch — a decision)

Staging ends `[ "$UP" = running ] || exit 1`. Production captures `RUNNING`,
`STARTED`, `BUILD_ID` and the HTTPS status and asserts **none** of them. It
fails on neither a dead container nor a non-200. The script with the customers
and the money has the weaker runtime proof.

The staging assertion copied across is a two-line change. It is listed
separately because it changes when a production deploy reports failure, and
that is a judgement call rather than a defect fix.
