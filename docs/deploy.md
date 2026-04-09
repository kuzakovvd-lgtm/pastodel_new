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

## Preview (unchanged)

- Preview config remains untouched:
  - `/etc/nginx/sites-enabled/pastodel_new_preview.conf`
- Preview endpoint remains available:
  - `http://127.0.0.1:8081`
