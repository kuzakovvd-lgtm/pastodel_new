# Handoff

## Current production state (April 9, 2026)

- Live cutover completed.
- Live domain `https://pastodel.ru` now serves from:
  - `root /var/www/pastodel_new/current;`
- Active staging/current release at cutover:
  - `/var/www/pastodel_new/releases/20260409-154930`
  - `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/20260409-154930`

## What was executed

1. Backup active config file:
   - source: `/etc/nginx/sites-enabled/pastodel.ru`
   - backup: `/etc/nginx/sites-enabled/pastodel.ru.bak.cutover-20260409-01`
2. Root switch in active file (`sites-enabled`).
3. `nginx -t` + `systemctl reload nginx`.
4. Post-switch live smoke passed (critical routes + canonical + robots + sitemap + assets on home page).
5. Synced `sites-available/pastodel.ru` from active config to remove drift.

## Important remediation after cutover

- Backup inside `sites-enabled` caused duplicate `server_name` warnings due wildcard include.
- Backup was moved (not deleted) to:
  - `/etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01`
- Re-validated with `nginx -t` and reloaded nginx.

## Post-cutover incident (resolved)

- Symptom: broken images on live (`/`, `/katalog/`).
- Investigation:
  - extracted real image URLs from live HTML (`src`/`srcset`)
  - checked HTTP status and content-type for `/_astro/*` and `/images/*`
  - verified files existed in `/var/www/pastodel_new/current` and release with correct perms
  - checked active nginx root/location/try_files rules
- Root cause:
  - backup config temporarily placed in `/etc/nginx/sites-enabled/` was included by wildcard and created duplicate `server_name` conflict.
- Fix:
  - moved backup to `/etc/nginx/backup/`
  - `nginx -t` + reload
  - re-ran live smoke; image assets now return `200` with `image/webp`.
  - added compatibility sync for stale hashed assets: previous release `/_astro/*` is merged into new release `/_astro/*` with `rsync --ignore-existing`.
  - additional compatibility for stale legacy app shell requests:
    - merged previous release `/js/*` and `/fonts/*` into current release with `rsync --ignore-existing`.
    - confirmed previously failing URLs from logs now return `200`.

## Current rollback reference

- Rollback source file:
  - `/etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01`
- Rollback command pattern:
  - copy backup back to `/etc/nginx/sites-enabled/pastodel.ru`
  - `nginx -t`
  - `systemctl reload nginx`

## Known limitation

- Forms production endpoint is still placeholder-safe and intentionally not integrated.

## GitHub sync state

- Repository: `kuzakovvd-lgtm/pastodel_new`
- Active branch: `main`
- Remote: `origin -> git@github.com:kuzakovvd-lgtm/pastodel_new.git`
- Publication issue was resolved:
  - previously `origin/main` was missing (`[gone]`, no remote heads)
  - executed safe publish: `git push -u origin main`
  - remote now contains full project tree (`README.md`, `src`, `docs`, `scripts`, config files) and current commit history.
