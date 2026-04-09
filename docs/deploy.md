# Deploy Plan (safe, separate from live)

## Current Server State (as of April 9, 2026)

Staging deploy for the new site was executed to a separate root, without traffic switch.

- Live site remains on: `/var/www/pastodel` (symlink to live release)
- New site staging root: `/var/www/pastodel_new`
- Current staged release: `/var/www/pastodel_new/releases/20260409-151205`
- Active staging symlink: `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/20260409-151205`
- Preview nginx endpoint: `127.0.0.1:8081` (localhost-only, no public domain switch)

## Build and Artifacts

Astro static output is deployed from `dist/`.

Expected minimum artifacts:
- `dist/index.html`
- `dist/_astro/*` (hashed assets)
- `dist/favicon.svg`

Build verification command:

```bash
scripts/check-build.sh
```

Known readiness warnings before cutover:
- `dist/robots.txt` not present
- sitemap file not present (`sitemap-index.xml` or `sitemap-0.xml`)

## Server Directory Layout

```text
/var/www/
  pastodel -> /var/www/pastodel-releases/<live-release>
  pastodel_new/
    releases/
      20260409-151205/
    current -> /var/www/pastodel_new/releases/20260409-151205
```

## Staging Deploy Commands

### Scripted (recommended)

Dry-run:

```bash
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-preview.sh
```

Apply:

```bash
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-preview.sh --apply
```

### Manual equivalent commands

```bash
npm run build

RELEASE_ID=$(date +%Y%m%d-%H%M%S)
DEPLOY_BASE=/var/www/pastodel_new
SERVER=<user>@<host>

ssh "$SERVER" "mkdir -p ${DEPLOY_BASE}/releases/${RELEASE_ID} ${DEPLOY_BASE}/releases"
COPYFILE_DISABLE=1 tar -C dist -cf - . | ssh "$SERVER" "tar -xf - -C ${DEPLOY_BASE}/releases/${RELEASE_ID}"
ssh "$SERVER" "find ${DEPLOY_BASE}/releases/${RELEASE_ID} -name '._*' -type f -delete"
ssh "$SERVER" "ln -sfn ${DEPLOY_BASE}/releases/${RELEASE_ID} ${DEPLOY_BASE}/current"
ssh "$SERVER" "find ${DEPLOY_BASE} -type d -exec chmod 755 {} +; find ${DEPLOY_BASE} -type f -exec chmod 644 {} +"
```

## Preview Verification Before Any Cutover

On server:

```bash
curl -sI http://127.0.0.1:8081/
curl -s http://127.0.0.1:8081/ | head -n 30
```

From local machine (via tunnel):

```bash
ssh -L 8081:127.0.0.1:8081 <user>@<host>
# then open http://127.0.0.1:8081
```

Recommended pre-cutover checks on preview:
- priority routes: `/`, `/katalog/`, `/katalog/[slug]/`, `/katalog/horeca/[slug]/`, `/partneram/`, `/horeca/`, `/stat-partnerom/`, `/kontakty/`
- forms placeholder behavior (no production endpoint integration)
- hashed assets served from `/_astro/`
- no broken links/images

## Nginx Preview Config (safe)

Current preview uses a separate localhost-only server block. Example:

```nginx
server {
  listen 127.0.0.1:8081;
  server_name _;

  root /var/www/pastodel_new/current;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /_astro/ {
    access_log off;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location ~* \.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
    access_log off;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }
}
```

## Safe Rollout Plan (future, only after explicit approval)

1. Freeze target release id in `/var/www/pastodel_new/releases/<id>`.
2. Re-run preview smoke + manual QA checklist.
3. Backup live nginx config file and capture current live symlink target.
4. Change live nginx `root` from live path to `/var/www/pastodel_new/current`.
5. `nginx -t` and only then `systemctl reload nginx`.
6. Validate live with route smoke checks and UI sanity checks.
7. Keep previous live release untouched for immediate rollback.

## Rollback Plan

If switch causes issues:

1. Restore previous live nginx `root` (or previous symlink target, depending on chosen switch method).
2. Run `nginx -t`.
3. Reload nginx.
4. Verify `https://pastodel.ru/` and key routes return expected old live output.

Rollback commands template:

```bash
# Example if switch is root-based in nginx config:
# 1) restore backup config
cp /etc/nginx/sites-available/pastodel.ru.bak.<timestamp> /etc/nginx/sites-available/pastodel.ru
nginx -t && systemctl reload nginx

# 2) post-rollback smoke
curl -sI https://pastodel.ru/
```

## What Was Not Changed in This Stage

- No live domain routing switch.
- No destructive actions on old site directory.
- No production forms endpoint integration.
