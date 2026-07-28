# PlacidCRM — go live on placidcrm.com in ~10 minutes

This is the fast path: create one DigitalOcean droplet that provisions itself,
then point GoDaddy at it. The droplet comes up already running PlacidCRM with
automatic HTTPS — no manual server setup, no certbot.

> The detailed/manual version (nginx, custom certs, troubleshooting) is in
> [`DEPLOY.md`](./DEPLOY.md). Use this file for the quick path.

---

## Step 1 — Create the self-provisioning droplet

1. Go to **https://cloud.digitalocean.com** → **Create → Droplets**.
2. **Region:** Sydney (SYD1) if you're in Australia.
3. **Image:** Ubuntu 24.04 (LTS).
4. **Size:** Basic → Regular → **2 GB RAM / 1 CPU** (the build needs the RAM;
   the cloud-init also adds swap as a safety net).
5. **Authentication:** add your SSH key (recommended) or a strong password.
6. Open **Advanced options → Add Initialization scripts (user data)** and paste
   the **entire contents of [`deploy/cloud-init.yaml`](./deploy/cloud-init.yaml)**
   into the box.
7. Click **Create Droplet**.

The droplet boots and runs the bootstrap automatically. Building the app takes
about **3–6 minutes**. You can watch it if you like:

```bash
ssh root@<droplet-ip>
tail -f /var/log/cloud-init-output.log        # provisioning progress
cd /opt/placidcrm && docker compose -f docker-compose.prod.yml logs -f app
```

**Copy the droplet's public IPv4 address** from the DigitalOcean page — you need
it for Step 2.

## Step 2 — Point GoDaddy at the droplet

Your domain currently resolves to `118.139.166.90`, which is **not** the droplet.
Update it:

1. Go to **https://dcc.godaddy.com/control/portfolio** → **placidcrm.com** → **DNS**.
2. Edit the records so they point to your **new droplet IP** (replace
   `<droplet-ip>`):

   | Type | Name | Value          | TTL    |
   |------|------|----------------|--------|
   | A    | `@`  | `<droplet-ip>` | 600    |
   | A    | `www`| `<droplet-ip>` | 600    |
   | A    | `*`  | `<droplet-ip>` | 600    |

   - Change the existing `@` and `www` A records (currently `118.139.166.90`).
   - Add the `*` (wildcard) record if it isn't there — it lets every future
     business get its own subdomain (e.g. `storage.placidcrm.com`) for free.
3. Save. DNS usually updates within a few minutes (can take up to an hour).

## Step 3 — First login

Once DNS has propagated, open **https://placidcrm.com** — Caddy will have issued
a real TLS certificate automatically (the padlock will be green).

- Go to **https://placidcrm.com/register** and create your **owner account**
  (the first registration becomes the super-admin; sign-up then closes).
- From the dashboard, click **+ Add business** for **Placid Storage Solutions**,
  then again for **Placid Homestead** (or run the seed — see below).

### Optional: start with the two Placid businesses pre-loaded

Instead of registering, SSH in and seed sample data:

```bash
cd /opt/placidcrm
docker compose -f docker-compose.prod.yml exec app node_modules/.bin/prisma db seed
# then sign in at /login with the credentials the seed prints
# (change the password immediately)
```

---

## Verifying / re-checking later

```bash
curl -s https://placidcrm.com/api/health      # {"status":"ok","db":"up",...}
```

## Updating to the latest code

```bash
ssh root@<droplet-ip>
cd /opt/placidcrm
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## What each thing costs

- The 2 GB droplet is about **US$12–14/month** on DigitalOcean.
- The domain you already own. TLS certificates are free (Let's Encrypt).

---

### If you'd rather I run it

I can't reach DigitalOcean or GoDaddy from the build sandbox (their APIs are
blocked by this environment's network policy), so I can't create the droplet or
edit DNS directly from here. If you want it fully hands-off, the cloud-init above
is as close as it gets — you paste one script and change three DNS records.
