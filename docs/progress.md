# Progress Log

## Status

Current phase: `Server pre-release staging completed (without cutover)`.

## What was done in this stage

- Verified server access and inspected existing nginx config safely.
- Confirmed live remains on `/var/www/pastodel` (symlink-based live release).
- Built local static output (`npm run build`).
- Performed real staging deploy to separate directory:
  - `/var/www/pastodel_new/releases/20260409-151205`
  - `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/20260409-151205`
- Removed macOS metadata files (`._*`) from staged release and normalized permissions.
- Added isolated preview nginx server block on localhost-only endpoint `127.0.0.1:8081`.
- Verified preview response (`HTTP 200`) and live response (`https://pastodel.ru`, `HTTP 200`) after changes.

## Production-readiness checks (no traffic switch)

Checked:
- build output is generated from Astro static mode
- hashed assets served from `/_astro/*`
- route output exists for key sections/pages
- forms remain in placeholder adapter mode (no unconfirmed endpoint integration)

Detected and documented for cutover preparation:
- `robots.txt` not present in `dist`
- sitemap file not present in `dist`

## Scripts

Added:
- `scripts/check-build.sh` — build + artifact checks + warnings for robots/sitemap
- `scripts/deploy-preview.sh` — safe deploy helper (dry-run by default, separate root only)

## What remains before final cutover

- Add/confirm `robots.txt` and sitemap generation strategy.
- Execute final preview smoke + visual pass on staged version.
- Receive explicit approval for live switch.
- Perform controlled switch + post-switch verification + rollback readiness.

## Risks / blockers

- Forms production endpoint still intentionally not integrated.
- Missing robots/sitemap in current output can affect SEO readiness if not handled pre-release.
- Live-to-new switch not executed in this phase by design.
