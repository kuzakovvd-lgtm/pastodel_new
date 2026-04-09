# Handoff

## Current pre-release state (April 9, 2026)

- New site staged and verified in isolated root:
  - `/var/www/pastodel_new/releases/20260409-154930`
  - `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/20260409-154930`
- Preview endpoint: `http://127.0.0.1:8081`
- Live domain `https://pastodel.ru` has NOT been switched.

## What is done

- Added SEO artifacts and generation:
  - `public/robots.txt`
  - Astro sitemap integration in config
- Added/updated deploy tooling:
  - `scripts/check-build.sh` (strict artifact checks)
  - `scripts/deploy-preview.sh` (deploy + owner/perms normalization)
  - `scripts/smoke-preview.sh` (portable preview smoke without `rg` dependency)
- Deployed new staging release and validated:
  - all required routes return HTTP 200 on preview
  - canonical/title checks pass
  - robots/sitemap host consistency pass
  - page asset URLs resolve without 404 in smoke scope
  - forms remain placeholder-safe

## What is NOT done

- No live cutover.
- No nginx live-root modification for domain traffic.
- No production forms endpoint integration.

## Remaining risks

- Forms endpoint is still placeholder-only by design.
- Release success in production still depends on controlled cutover and immediate post-switch smoke.

## Next step

1. Wait for explicit user confirmation to execute cutover.
2. Perform cutover exactly per `docs/deploy.md` (backup config -> root switch -> nginx test/reload).
3. Run first-5-minute post-switch smoke.
4. If needed, execute rollback plan from `docs/deploy.md`.
