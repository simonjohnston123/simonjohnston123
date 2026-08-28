# Shared, scoped deploy access for agent identities

Companion to `staging-deploy/` (PR #1). That directory provisions the
**GitHub Actions** staging identity. This one adds **named agent identities** — Claude, Manus and GPT — on top
of it, each with its own key and its own scoped role, without touching the
CI path.

No private key is handled anywhere here. You supply a **public** key the
agent generated and kept; the private half never reaches the droplet, this
repo, or a chat log.

---

## Read this first: what this session could and could not do

The access request asked for six things. **Steps 1–6 all require a shell on
the droplet, and this is a Claude Code *web* session, which structurally
cannot have one.** Verified, not assumed:

| Capability | Result |
|---|---|
| `ssh` client | not installed |
| private keys in `~/.ssh` | none |
| outbound TCP/22 | blocked — the proxy is HTTPS-only |
| `placidgroup/placid-crm` | cannot be attached (cross-owner limit) |

That last row matters most: **PR #12 and commit `cbe7703` live in
`placid-crm`, which this session cannot read.** The only repo in scope is
the profile repo.

So the report the request asked for — key fingerprints, the staging SHA,
the production SHA, the public verification URL — **cannot be produced from
here**, because every value in it comes from a droplet command that cannot
be run. Any such report would be invented, so none is given.

`staging-deploy/README.md` already recorded this limit: *"provisioning
needs a root shell on the droplet, which a sandboxed agent session does not
have… web sessions are fine for repo changes and reasoning, and
structurally wrong for anything that has to touch a host."* That is still
true, and it is why this directory is **the provisioning, not the run**.

**To finish the job, run these from the DigitalOcean web console or a local
Claude Code CLI session** (both have a real shell), per the routes in
`staging-deploy/README.md`.

---

## Why both keys were rejected — a hypothesis to confirm, not a conclusion

Confirm with `./provision-agent-access.sh --check` before believing it.

**The staging key.** `staging-deploy/provision-staging-ci-access.sh` ends
with:

```sh
printf 'restrict,command="%s" %s\n' "$SSHGATE" "$(cat "${KEY_OUT}.pub")" > "$HOME_SSH/authorized_keys"
```

That is `>`, not `>>`. The file is **truncated to exactly one key** every
run. Any Manus key added by hand is deleted the next time that script is
re-run — silently, with a success message. This is the single most likely
cause of "the restricted staging key was rejected", and it is why
everything in this directory is line-scoped and additive instead.

**The production key.** There is no forced-command production identity on
the droplet to reject a key *for*. The staging wrapper's only production
contact is three read-only verbs. The only credential that can actually
release is `placid_connect_devbeta` — root on the box that runs
production — which is deliberately not handed to an agent. So "the droplet
rejected the expected production key" is the system working: the identity
requested in step 4 **did not exist yet**. `prod-release-ctl` creates it.

---

## Usage

Identities are `<agent>-<role>`. Three agents — **claude, manus, gpt** — and
two roles, **staging** and **release**. Adding a fourth agent is one word in
the `AGENTS` line.

`--list` needs no droplet and no root; run it anywhere, including on an
agent's own machine, to see exactly what an identity will be able to do:

```
$ ./provision-agent-access.sh --list
IDENTITY           SSH USER               ALLOWED VERBS
claude-staging     placid-staging-deploy  fetch-checkout compose-build compose-up staging-status staging-migration-count
claude-release     placid-prod-release    release release-preflight prod-deployed-commit prod-started-at ...
manus-staging      placid-staging-deploy  fetch-checkout compose-build compose-up staging-status staging-migration-count
manus-release      placid-prod-release    release release-preflight prod-deployed-commit prod-started-at ...
gpt-staging        placid-staging-deploy  fetch-checkout compose-build compose-up staging-status staging-migration-count
gpt-release        placid-prod-release    release release-preflight prod-deployed-commit prod-started-at ...
```

Everything below runs as root on the droplet. Idempotent; `--check` changes
nothing.

### Onboarding all three agents

**Each agent generates its own keypair and sends you only the `.pub`.** It
keeps the private half; nothing secret is ever pasted anywhere.

```sh
ssh-keygen -t ed25519 -C "manus staging deploy" -f ~/.ssh/placid_manus   # on the agent's machine
```

Then, on the droplet:

```sh
# 0. See what is actually installed now, fingerprints included
./provision-agent-access.sh --check

# 1. Staging for all three
./provision-agent-access.sh --identity claude-staging --pubkey /root/claude.pub
./provision-agent-access.sh --identity manus-staging  --pubkey /root/manus.pub
./provision-agent-access.sh --identity gpt-staging    --pubkey /root/gpt.pub

# 2. Production release identities, if wanted. The release verb ships DISABLED.
./provision-agent-access.sh --identity manus-release  --pubkey /root/manus.pub
./provision-agent-access.sh --identity gpt-release    --pubkey /root/gpt.pub

# 3. Rotation is the same command with a new key. Revocation is one flag.
./provision-agent-access.sh --identity gpt-staging --revoke
```

Order does not matter and re-runs are safe: each command touches only its
own key line. Delete the `.pub` files afterwards — they are not secret, just
clutter.

Then, **from each agent's own machine**, before anyone relies on it:

```sh
./verify-agent-gate.sh <host> ~/.ssh/placid_manus manus-staging [expected-fingerprint]
```

### What to hand each agent

Only three things, none of them secret: the **username** for its role
(`placid-staging-deploy` or `placid-prod-release`), the **host**, and its
**verb list**. An agent that is told more than this has been told too much.

## The request, point by point

**1. Least privilege, no private keys in chat.** Held. Public keys only.
Two users — `placid-staging-deploy` and `placid-prod-release` — neither in
the `docker` group (the script hard-fails if either is: `docker run -v
/:/host` reaches `/opt/placidcrm`), neither owning the production
directory, each able to `sudo` exactly one root-owned wrapper. No shell,
no port forwarding, no agent forwarding, no pty.

**2. The staging allow-list.** Exactly the five verbs requested:

```
fetch-checkout  compose-build  compose-up  staging-status  staging-migration-count
```

All five already exist in the CI wrapper, so this adds no new capability to
the droplet — it grants a subset of what CI can already do. Deliberately
**excluded**: `migrate-deploy`, `receive-archive` (the unbound-sha path the
staging README documents as forgeable), and `record-deployment` (a write to
the *production* database). So no staging identity can write to any
database.

The list is defined **once, per role**, and shared by claude, manus and gpt.
That is deliberate: a per-agent copy of the list is a list that drifts, and
a verb quietly appearing in one agent's copy and not another's is exactly
the drift nobody notices. Agents still get separate keys and separate
identities, so the auth log distinguishes them and access is revoked one
agent at a time.

Allow-lists live at `/etc/placid-agent-access/<identity>.allow` and are
matched with `grep -qxF` — an exact whole-line match, so `compose` cannot
admit `compose-up`. The identity is baked into the `authorized_keys` forced
command, so the client never chooses which list applies to it. Both halves
of an identity are checked against the registry, so `gpt-root` or a
misspelled `gpt-stagng` is refused outright rather than provisioned with a
silently empty list.

**3. Fingerprints, and not trusting a filename.** `--check` runs
`ssh-keygen -lf` against `authorized_keys` **itself** and prints what is
genuinely installed. `verify-agent-gate.sh` then closes the loop from the
other side: it fingerprints the local private key, optionally compares it
to an expected value, and connects with `-o BatchMode=yes -o
IdentitiesOnly=yes`. Those two flags are the actual proof — no agent, no
password, no other key can stand in, so a successful authentication means
the droplet authorises *that* key. A filename never proved anything.

**4. Separate production release identity.** `placid-prod-release`, its own
user, its own wrapper (`prod-release-ctl`), routed by identity rather than
by verb — a staging key cannot reach the release wrapper even if a verb
name collided. Six read-only verbs work immediately. The one mutating verb,
`release`, **ships disabled** and refuses with exit 67 until someone
deliberately runs `touch /etc/placid-prod-release/allow-release`. It also
requires the SHA to appear in `/etc/placid-prod-release/approved-shas`, a
root-owned file the release identity cannot write. No unrestricted root
SSH anywhere.

**5. The production guard — NOT confirmed, and here is why.**
`scripts/deploy-production.sh` lives in `placid-crm`, which this session
cannot read. **Confirming its six conditions was not possible, so it is not
claimed.** What was done instead: `prod-release-ctl`'s `preflight()`
enforces those conditions *droplet-side*, as an independent layer —
approved SHA, exact match against staging's `DEPLOYED_COMMIT`, clean
production tree, verified `pg_dump` before anything is touched, build
success with tree rollback on failure, migration counts reported, and
public HTTPS 200 both before and after, with automatic rollback if health
never returns.

> **This wrapper has never been executed.** It was written against a
> deployment it cannot see, in a sandbox with no droplet. Read it against
> the real `deploy-production.sh` and reconcile the two **before** enabling
> `release`. That is exactly what the disabled-by-default flag is for.

**6. Deploy `cbe7703` to staging and promote it.** Not done, and not
possible from here — the commit is in a repo this session cannot read, and
the deploy needs the droplet. This is the step to run once access is
repaired.

---

## What was actually verified

The gate logic was extracted and run against stub wrappers in this sandbox
— **30 cases across all three agents, all passing** — plus registry
validation and a key-management simulation. Specifically confirmed:

- All six identities resolve to the right user and the right verb list;
  nine malformed ones (`gpt-stagng`, `chatgpt-staging`, `gpt-root`,
  `gpt-production`, `root-staging`, `gpt`, `gpt-`, `-staging`,
  `manus-staging-2`) are refused rather than provisioned empty.
- **Cross-role isolation:** a `-staging` identity cannot reach any `prod-*`
  verb or `release`; a `-release` identity cannot reach `compose-up` or
  `fetch-checkout`. Routing is by identity, so the two wrappers stay
  separate even if a verb name collided.
- No staging identity can reach `migrate-deploy`, `record-deployment` or
  `receive-archive` — verified per agent, not just once.
- Adding a key for one identity leaves the CI key and every other agent's
  key untouched; revoking one identity revokes exactly one.

Writing it this way found and fixed two real bugs:

1. **`compose-build zzzz` returned 64, the same code as "verb not
   permitted."** A no-argument verb and a forbidden verb were
   indistinguishable, so there was no way to confirm a mutating verb was
   reachable without running it. The exit codes are now a contract:
   **64 = verb not on the allow-list, 65 = verb allowed, argument wrong.**
   That gap is what lets `verify-agent-gate.sh` prove `compose-up` is
   permitted *without ever deploying anything* — it probes with a bad
   argument and reads the code. Do not collapse these two codes.

2. **Revoking `manus-staging` also revoked `manus-staging-2`.** The
   marker match was an unanchored substring, so one identity silently
   revoked another. Both the install and revoke paths are now anchored to
   end-of-line.

**What is still unverified:** everything that needs the droplet — the
wrappers' real behaviour, `sudo`/`sshd` interaction, the forced command
under a genuine login, and every line of `prod-release-ctl`. Stub tests
prove the dispatch logic and nothing more. Run `verify-agent-gate.sh` on
the real host; treat that, not this file, as the evidence.
