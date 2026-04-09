# Handoff

## Current state

The new Astro project has been staged on server in a separate directory and is previewable without touching live traffic.

- Live remains active and unchanged.
- Staged build location:
  - `/var/www/pastodel_new/releases/20260409-151205`
  - `/var/www/pastodel_new/current` -> staged release
- Preview endpoint:
  - `http://127.0.0.1:8081` (localhost-only nginx server block)

## What was completed

- Safe server discovery (nginx + current live root mapping).
- Real staging deploy (separate root, no overwrite of old live paths).
- Permission normalization and metadata cleanup on staged release.
- Preview server block configured and validated (`nginx -t`, reload, `HTTP 200` on preview).
- Confirmed live domain still returns `HTTP 200` after staging actions.
- Added deploy tooling:
  - `scripts/check-build.sh`
  - `scripts/deploy-preview.sh` (dry-run default)
- Updated deployment runbook and rollout/rollback instructions in `docs/deploy.md`.

## What is not done

- No live domain switch/cutover.
- No nginx live-root change.
- No production forms endpoint integration.
- No robots/sitemap integration in current build output.

## Risks

- `robots.txt` and sitemap are currently missing in `dist`, which should be resolved before final release.
- Forms still use placeholder adapter by design; backend integration is a separate confirmed step.
- Cutover was intentionally deferred; final release still requires explicit go-ahead.

## Next step

1. Add/confirm SEO static files strategy (`robots.txt` + sitemap generation).
2. Run final pre-cutover smoke checklist against preview (`127.0.0.1:8081`).
3. Prepare cutover change as a minimal nginx root switch with backup.
4. Execute switch only after explicit approval, then run post-switch verification.
5. Keep rollback command path ready (restore backup config + nginx reload).
