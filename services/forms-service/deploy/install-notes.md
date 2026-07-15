# Deployment notes (not executed)

These notes describe a future audited deployment. They are not commands to run without a separate approval.

## Prerequisites

- Approved SMTP host, port, secure mode, username, password and From mailbox.
- Recipient remains server configuration through `PASTODEL_FORMS_TO`.
- Dedicated `pastodel-forms` service user and group.
- Root-owned `/etc/pastodel/forms.env`, mode 0600, outside Git and web releases.
- Reviewed nginx/systemd templates and confirmed the dedicated Node.js 24 LTS path `/opt/node-v24/bin/node`.
- Approved monitoring owner, log retention and rollback operator.

## Backend release

1. Copy only the reviewed service release to a versioned directory below `/opt/pastodel-forms/releases/`.
2. Install from the service lockfile with production dependencies only using Node.js 24 LTS.
3. Point `/opt/pastodel-forms/current` to the new version while retaining the previous version.
4. Install/reload the reviewed unit only after `systemd-analyze verify` and security review.
5. Start the loopback service and verify process state plus `GET http://127.0.0.1:8787/health`.
6. Run `npm run smtp:verify` only as a separately approved staging preflight. It authenticates but does not send mail; never call it in a production startup loop.

## Nginx

1. Add the rate-limit zone once to the `http` context.
2. Add only the exact `/api/forms` location to the HTTPS server.
3. Run `nginx -t` before reload.
4. Confirm `/health` remains unavailable publicly and `/api/forms` does not accept GET.

The proposed limits (`10r/m`, burst 5, 32 KiB) require production approval. Start staging observation with `limit_req_dry_run on`, review results, then remove dry-run and enable enforcement only after approval.

`$binary_remote_addr` is correct when nginx sees the direct client address. If a CDN or trusted reverse proxy is introduced, real-IP configuration requires a separate review; never trust arbitrary `X-Forwarded-For`.

## Frontend release

After backend and nginx health checks pass, build a fresh frontend release with:

```text
PUBLIC_PASTODEL_FORMS_ENDPOINT=https://pastodel.ru/api/forms
PUBLIC_PASTODEL_FORMS_TIMEOUT_MS=10000
PUBLIC_ALLOW_FORM_STUB=0
```

The public endpoint URL is not a secret. SMTP settings must never enter frontend build variables.

## Environment file

`/etc/pastodel/forms.env` must be root-owned, mode 0600, outside Git, releases and the web root. Backups must be handled as secrets. Use systemd `EnvironmentFile` syntax rather than shell expansion; quote values containing spaces or `#`, prohibit line breaks, and validate special-character credentials in staging without printing them.

The SMTP provider must authorize the approved From address. The provider/domain owner must confirm SPF, DKIM and DMARC readiness; do not add local DKIM signing unless the provider design requires it.

## Approved smoke sequence

1. Safe GET/HEAD checks and endpoint method/content-type rejection checks.
2. One synthetic staging submission for every form to a test-only recipient.
3. Only after separate approval, one clearly marked production submission.
4. Confirm the expected recipient, subject prefix, request ID, Reply-To and plain-text body.
5. Confirm operational logs contain no payload or PII.

## Rollback

1. Restore the previous static frontend release or remove its endpoint configuration to return forms to fail-closed mode.
2. Remove/disable the exact nginx proxy location and validate/reload nginx.
3. Point the service symlink to the previous release or stop the new unit.
4. Confirm public forms show the unavailable state and no `/api/forms` upstream remains exposed.
5. Preserve metadata-only incident logs; do not copy mail bodies or SMTP secrets into the incident report.
