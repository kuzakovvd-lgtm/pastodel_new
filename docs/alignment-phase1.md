# Phase 1 Remediation: Safe Alignment Rules

## Source of truth model

- Source code canonical: `origin/main` in GitHub.
- Production runtime state is mixed temporarily:
  - canonical build artifacts from repo (`dist/*`)
  - compatibility overlay files on server (`_astro/*`, `js/*`, `fonts/*`) to protect stale clients.

## Compatibility overlay policy (Phase 1)

- Do not delete compatibility files yet.
- Do not run destructive cleanup on `/var/www/pastodel_new/current`.
- Keep overlay until manifest-based evidence confirms safe removal.

## Safe deploy order (no blind overwrite)

1. Build and validate locally: `scripts/check-build.sh`
2. Generate build manifest: `scripts/release-manifest.sh local --root dist --output <local.tsv>`
3. Snapshot server state (release dir + nginx config + logs).
4. Deploy new release with `scripts/deploy-preview.sh --apply`.
5. Run repeatable checks:
   - `BASE_URL=https://pastodel.ru scripts/validate-deploy.sh`
6. Capture server manifest and classify:
   - `scripts/release-manifest.sh server --host <user@host> --root /var/www/pastodel_new/current --output <server.tsv>`
   - `scripts/release-manifest.sh classify --local <local.tsv> --server <server.tsv> --output <report.md>`

## Rollback procedure

1. Repoint `/var/www/pastodel_new/current` to previous release symlink target.
2. Validate nginx config: `nginx -t`
3. Reload nginx: `systemctl reload nginx`
4. Re-run `scripts/validate-deploy.sh` against production URL.

## Cleanup restrictions (Phase 1)

- Never delete `/_astro`, `/js`, `/fonts` compatibility files during incident response.
- Never remove release directories without checksum manifest and retention decision.
- Never alter nginx live file without backup stored outside `sites-enabled`.
