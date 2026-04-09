# Progress Log

## Status

Current phase: `Final pre-cutover validation completed (no cutover executed)`.

## Confirmed in this phase

- SEO/runtime artifacts implemented and verified:
  - `robots.txt` in build output
  - sitemap generation enabled via Astro sitemap integration
  - canonical links use production host `https://pastodel.ru`
  - favicon/static essentials present
- New staging release deployed:
  - `/var/www/pastodel_new/releases/20260409-154930`
  - `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/20260409-154930`
- Staging ownership normalized (`root:root`) and permissions normalized.
- Final preview smoke-check passed on `http://127.0.0.1:8081` for all required routes.
- Confirmed forms remain placeholder-safe (no unverified production endpoint wiring).

## Smoke scope (passed)

Routes:
- `/`
- `/katalog/`
- `/katalog/karbonara/`
- `/katalog/horeca/karbonara/`
- `/partneram/`
- `/horeca/`
- `/stat-partnerom/`
- `/kontakty/`
- `/o-kompanii/`
- `/gde-kupit/`
- `/otzyvy/`
- `/dokumenty/`
- `/novosti/`
- `/proizvodstvo-i-kachestvo/`
- `/politika-konfidentsialnosti/`
- `/soglasie-na-obrabotku-dannyh/`

Checks:
- HTTP 200
- title + canonical present
- canonical host is production domain
- page assets return 200
- robots/sitemap host consistency
- forms placeholder-safe runtime markers

## Remaining risks

- Production forms endpoint is intentionally not integrated (known and accepted for this stage).
- Cutover not performed yet (blocked by explicit approval requirement).

## Ready state

- Ready for controlled switch from infrastructure perspective.
- Awaiting explicit go/no-go confirmation for live cutover.
