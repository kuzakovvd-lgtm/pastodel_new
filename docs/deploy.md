# Deploy and Cutover Runbook

## Current live state (April 9, 2026)

- Live domain `https://pastodel.ru` is switched to new project root:
  - `root /var/www/pastodel_new/current;`
- Active config file in use:
  - `/etc/nginx/sites-enabled/pastodel.ru`
- Drift removed:
  - `/etc/nginx/sites-available/pastodel.ru` synced with active file.
- Backup retained at:
  - `/etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01`

## Commands that were executed for cutover

```bash
# 1) backup active file
cp /etc/nginx/sites-enabled/pastodel.ru /etc/nginx/sites-enabled/pastodel.ru.bak.cutover-20260409-01

# 2) switch active root
sed -i 's#root /var/www/pastodel;#root /var/www/pastodel_new/current;#' /etc/nginx/sites-enabled/pastodel.ru

# 3) validate and reload
nginx -t
systemctl reload nginx
```

## Post-switch smoke (live)

Validated successfully:
- `/`
- `/katalog/`
- `/katalog/karbonara/`
- `/katalog/horeca/karbonara/`
- `/partneram/`
- `/kontakty/`
- canonical on `/`
- `robots.txt`
- `sitemap-index.xml`
- homepage asset URLs (no 404)

## Important note about backup placement

Because nginx includes `/etc/nginx/sites-enabled/*`, backup files inside that directory are parsed and can cause duplicate `server_name` warnings.

Applied remediation:

```bash
mkdir -p /etc/nginx/backup
mv /etc/nginx/sites-enabled/pastodel.ru.bak.cutover-20260409-01 /etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01
nginx -t
systemctl reload nginx
```

## Rollback (current reference)

```bash
cp /etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01 /etc/nginx/sites-enabled/pastodel.ru
nginx -t
systemctl reload nginx
```

## Incident note: broken images after cutover

Observed symptom:
- broken logo/hero/catalog images on live shortly after switch.

Root cause:
- backup file was created inside `/etc/nginx/sites-enabled/` and got included by wildcard include.
- this created duplicate `server_name` entries and unstable config selection during requests.

Fix applied:
1. move backup out of `sites-enabled` into `/etc/nginx/backup/`
2. `nginx -t`
3. `systemctl reload nginx`
4. run live smoke for `/`, `/katalog/`, product pages and image assets.

Prevention for next cutovers:
- create backup directly in `/etc/nginx/backup/`, never inside `sites-enabled/`.
- preserve hashed asset backward compatibility for stale HTML caches:
  - before switching symlink, merge previous `current/_astro/` into new `release/_astro/` with `rsync --ignore-existing`.
  - also preserve legacy `/js/*` and `/fonts/*` from previous current to protect users with stale old app shell.
  - this is now built into `scripts/deploy-preview.sh` (`PRESERVE_ASTRO_ASSETS=1` by default).

## Preview (unchanged)

- Preview config remains untouched:
  - `/etc/nginx/sites-enabled/pastodel_new_preview.conf`
- Preview endpoint remains available:
  - `http://127.0.0.1:8081`

## Phase 1 hardening additions

- Build now writes `dist/release-meta.json` for traceability (git SHA + build timestamp + release id).
- `scripts/check-build.sh` validates release metadata presence and key route artifacts.
- Repeatable post-deploy verification entrypoint:
  - `BASE_URL=https://pastodel.ru scripts/validate-deploy.sh`
- Cleanup guardrail:
  - compatibility overlay files (`_astro`, `js`, `fonts`) must not be deleted until manifest-based classification is complete.
- Manifest tooling for evidence-based cleanup preparation:
  - local: `scripts/release-manifest.sh local --root dist --output local.tsv`
  - server: `scripts/release-manifest.sh server --host <user@host> --root /var/www/pastodel_new/current --output server.tsv`
  - classify: `scripts/release-manifest.sh classify --local local.tsv --server server.tsv --output report.md`

## Phase 2 additions

### Real forms endpoint contract

- Frontend variable: `PUBLIC_PASTODEL_FORMS_ENDPOINT` (required in production).
- Timeout variable: `PUBLIC_PASTODEL_FORMS_TIMEOUT_MS` (default `10000`).
- Success is shown only when backend response matches contract from `docs/forms-backend-contract.md`.
- Any timeout/network/non-2xx/malformed response is treated as failure and shown to user.

### Pre-deploy snapshot

Use:

```bash
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/pre-deploy-snapshot.sh
```

Snapshot captures:
- current symlink target for `/var/www/pastodel_new/current`
- tarball of current release directory
- live nginx config copy
- nginx log file inventory and byte offsets
- timestamped `snapshot-meta.json`

Default snapshot location on server:
- `/var/backups/pastodel-snapshots/<timestamp>/`

### Safe deploy orchestrator

Use:

```bash
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-safe.sh
```

Flow:
1. pre-deploy snapshot
2. build + deploy release
3. verify `/release-meta.json` on active release
4. run production smoke validation
5. print explicit rollback command if validation fails

### Baseline manifest policy

Create and store baseline artifacts:

```bash
scripts/release-manifest.sh local --root dist --output docs/baselines/local-<date>.tsv
scripts/release-manifest.sh server --host <user@host> --root /var/www/pastodel_new/current --output docs/baselines/server-<date>.tsv
scripts/release-manifest.sh classify --local docs/baselines/local-<date>.tsv --server docs/baselines/server-<date>.tsv --output docs/baselines/classification-<date>.md
```

Cleanup of compatibility files is prohibited until decisions reference this baseline.
