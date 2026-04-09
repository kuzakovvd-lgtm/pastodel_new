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

## Current rollback reference

- Rollback source file:
  - `/etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01`
- Rollback command pattern:
  - copy backup back to `/etc/nginx/sites-enabled/pastodel.ru`
  - `nginx -t`
  - `systemctl reload nginx`

## Known limitation

- Forms production endpoint is still placeholder-safe and intentionally not integrated.
