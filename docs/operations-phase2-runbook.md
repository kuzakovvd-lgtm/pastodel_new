# Operations Runbook (Phase 2)

## Required environment

Frontend build variables:
- `PUBLIC_PASTODEL_FORMS_ENDPOINT` (required in production)
- `PUBLIC_PASTODEL_FORMS_TIMEOUT_MS` (optional, default `10000`)
- `PUBLIC_ALLOW_FORM_STUB=0` in production

Deploy variables:
- `DEPLOY_HOST` (required)
- `DEPLOY_USER` (default `root`)
- `DEPLOY_BASE` (default `/var/www/pastodel_new`)
- `SSH_PORT` (default `22`)

## Safe production deploy sequence

1. Build and local artifact checks:
   - `scripts/check-build.sh`
2. Snapshot current production state:
   - `DEPLOY_HOST=<host> DEPLOY_USER=root scripts/pre-deploy-snapshot.sh`
3. Deploy with guardrails:
   - `DEPLOY_HOST=<host> DEPLOY_USER=root scripts/deploy-safe.sh`
4. Post-deploy validation:
   - `BASE_URL=https://pastodel.ru scripts/validate-deploy.sh`
5. Save manifest baseline:
   - local + server + classify reports in `docs/baselines/`

## Rollback

If deploy validation fails:

1. Use previous target from snapshot metadata:
   - `CURRENT_TARGET` from `<snapshot-dir>/snapshot-meta.json`
2. Repoint symlink and reload nginx:
   - `ln -sfn '<previous-target>' /var/www/pastodel_new/current`
   - `nginx -t`
   - `systemctl reload nginx`
3. Re-run:
   - `BASE_URL=https://pastodel.ru scripts/validate-deploy.sh`

## Cleanup restrictions (still active)

- Do not delete compatibility files under `_astro`, `js`, `fonts`.
- Do not delete old releases without manifest evidence and retention approval.
- Do not modify nginx live config without creating backup outside `sites-enabled`.
