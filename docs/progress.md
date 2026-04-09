# Progress Log

## Status

Current phase: `Cutover executed successfully`.

## What was done

- Received explicit GO and executed cutover using active nginx file:
  - `/etc/nginx/sites-enabled/pastodel.ru`
- Backup created:
  - `/etc/nginx/sites-enabled/pastodel.ru.bak.cutover-20260409-01`
- Root switched:
  - from `root /var/www/pastodel;`
  - to `root /var/www/pastodel_new/current;`
- `nginx -t` passed and nginx reloaded.
- Post-switch smoke on live domain passed for critical routes and SEO checks.
- Detected warning source: backup file inside `sites-enabled` matched wildcard include and produced duplicate `server_name` warnings.
- Remediation applied:
  - backup moved to `/etc/nginx/backup/pastodel.ru.bak.cutover-20260409-01`
  - `nginx -t` passed again and nginx reloaded again
- Drift removed:
  - synced `/etc/nginx/sites-available/pastodel.ru` from active `/etc/nginx/sites-enabled/pastodel.ru`.

## Live state now

- `https://pastodel.ru` serves from:
  - `root /var/www/pastodel_new/current;`
- Critical live smoke checks passed:
  - `/`, `/katalog/`, `/katalog/karbonara/`, `/katalog/horeca/karbonara/`, `/partneram/`, `/kontakty/`
  - canonical on `/` is `https://pastodel.ru/`
  - `robots.txt` includes sitemap line for `https://pastodel.ru/sitemap-index.xml`
  - `sitemap-index.xml` returns `HTTP 200`

## Remaining risks

- Forms endpoint remains placeholder by design (known limitation, unchanged).

## Next step

- Observe logs/metrics after cutover window and continue content/UX iteration if needed.
