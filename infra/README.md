# Infrastructure Tracking (Phase 1)

This directory tracks production-relevant infrastructure state as code templates.

## Nginx

- Template: `infra/nginx/pastodel.ru.conf.template`
- Placeholders to replace before apply:
  - `__SSL_CERT_PATH__`
  - `__SSL_KEY_PATH__`
  - `__WEB_ROOT__` (expected current live: `/var/www/pastodel_new/current`)

## Expected release layout on server

- Base directory: `/var/www/pastodel_new`
- Releases: `/var/www/pastodel_new/releases/<release-id>`
- Active symlink: `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/<release-id>`

## Notes

- This is not full IaC yet. Apply remains manual in Phase 1.
- Always validate with `nginx -t` before reload.
- Keep rollback backup outside `sites-enabled` (for example `/etc/nginx/backup`).
