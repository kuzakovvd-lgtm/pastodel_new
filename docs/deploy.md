# Deploy Plan (final pre-cutover, no live switch executed)

## Confirmed current state (April 9, 2026)

- Live domain `https://pastodel.ru` is still active and not switched.
- Staging root (new site): `/var/www/pastodel_new`
- Current staged release: `/var/www/pastodel_new/releases/20260409-154930`
- Current symlink: `/var/www/pastodel_new/current -> /var/www/pastodel_new/releases/20260409-154930`
- Preview endpoint: `http://127.0.0.1:8081` (localhost-only nginx server block)

## Build / runtime artifacts

Confirmed in build output:
- `dist/index.html`
- `dist/_astro/*` hashed assets
- `dist/favicon.svg`
- `dist/robots.txt`
- `dist/sitemap-index.xml` and `dist/sitemap-0.xml`

SEO host consistency:
- canonical uses `https://pastodel.ru/...`
- robots sitemap points to `https://pastodel.ru/sitemap-index.xml`
- sitemap URLs use `https://pastodel.ru/...`
- preview host is not used in canonical/robots/sitemap

## Staging deploy (safe, separate root)

### Scripted

Dry-run:

```bash
DEPLOY_HOST=85.239.63.149 DEPLOY_USER=root scripts/deploy-preview.sh
```

Apply:

```bash
DEPLOY_HOST=85.239.63.149 DEPLOY_USER=root scripts/deploy-preview.sh --apply
```

What script does:
1. Builds and verifies artifacts via `scripts/check-build.sh`
2. Uploads `dist/` into `/var/www/pastodel_new/releases/<timestamp>`
3. Removes macOS `._*` files
4. Updates `/var/www/pastodel_new/current` symlink
5. Normalizes owner/group (default `root:root`) and perms (`755` dirs, `644` files)

## Final smoke-check on preview

Run on server via local repo:

```bash
ssh root@85.239.63.149 'BASE_URL=http://127.0.0.1:8081 bash -s' < scripts/smoke-preview.sh
```

Smoke covers:
- HTTP 200 for required routes
- HTML title + canonical on required routes
- no canonical to preview host
- asset URLs from page HTML return 200
- robots/sitemap host consistency
- forms remain placeholder-safe (runtime + placeholder note)

## Final cutover plan (prepared, not executed)

### 5 minutes before switch

1. Confirm staging target:

```bash
ssh root@85.239.63.149 "readlink -f /var/www/pastodel_new/current"
```

2. Confirm live still healthy:

```bash
curl -sI https://pastodel.ru/
```

3. Backup nginx live config:

```bash
ssh root@85.239.63.149 "cp /etc/nginx/sites-available/pastodel.ru /etc/nginx/sites-available/pastodel.ru.bak.$(date +%Y%m%d-%H%M%S)"
```

### Cutover action (single config change + reload)

Change live server block root in `/etc/nginx/sites-available/pastodel.ru`:
- from current live root
- to: `root /var/www/pastodel_new/current;`

Then validate and reload:

```bash
ssh root@85.239.63.149 "nginx -t && systemctl reload nginx"
```

### First 5 minutes after switch

1. Route smoke:

```bash
for p in / /katalog/ /katalog/karbonara/ /katalog/horeca/karbonara/ /partneram/ /horeca/ /stat-partnerom/ /kontakty/ /o-kompanii/ /gde-kupit/ /otzyvy/ /dokumenty/ /novosti/ /proizvodstvo-i-kachestvo/ /politika-konfidentsialnosti/ /soglasie-na-obrabotku-dannyh/; do
  curl -s -o /dev/null -w "%{http_code} ${p}\n" "https://pastodel.ru${p}";
done
```

2. SEO quick checks:

```bash
curl -s https://pastodel.ru/ | grep -Eo '<link rel="canonical" href="[^"]+"' | head -n 1
curl -s https://pastodel.ru/robots.txt
curl -sI https://pastodel.ru/sitemap-index.xml
```

3. Confirm no spike of 404 in nginx logs.

## Rollback plan (prepared, not executed)

Rollback target: restore previous nginx config backup and reload.

### Rollback command path

1. Restore backup config:

```bash
ssh root@85.239.63.149 "cp /etc/nginx/sites-available/pastodel.ru.bak.<timestamp> /etc/nginx/sites-available/pastodel.ru"
```

2. Validate and reload nginx:

```bash
ssh root@85.239.63.149 "nginx -t && systemctl reload nginx"
```

3. Verify rollback:

```bash
curl -sI https://pastodel.ru/
```

Rollback is 2 operational steps (restore + reload), then smoke verification.

## What was not changed in this phase

- No live routing switch executed.
- No deletion of old live directories.
- No production forms endpoint integration.
