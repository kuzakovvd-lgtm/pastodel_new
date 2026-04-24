# Cloudflare CDN Runbook

## Current checkpoint

- Date: 2026-04-24
- Repository: `kuzakovvd-lgtm/pastodel_new`
- Branch: `main`
- Live SHA: `f8ada754e445d4213fa8e3499188fe3a21365e04`
- Live release: `20260424-0728-smoke-fix`
- Active release path: `/var/www/pastodel_new/releases/20260424-0728-smoke-fix`
- Server snapshot: `/var/backups/pastodel-snapshots/20260424-080651-cdn-checkpoint`
- Current live edge: direct `nginx/1.24.0 (Ubuntu)`, no Cloudflare headers yet.

## DNS records

Create these records in Cloudflare DNS after adding `pastodel.ru` to a Free Cloudflare zone:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| `A` | `@` | `85.239.63.149` | Proxied |
| `CNAME` | `www` | `pastodel.ru` | Proxied |

Do not change the origin IP during CDN cutover.

## Cloudflare settings

- SSL/TLS encryption mode: `Full`.
- Keep origin HTTPS enabled on port `443`.
- Enable Brotli.
- Enable HTTP/2 and HTTP/3.
- Enable Auto Minify for HTML, CSS, and JavaScript only if visual smoke tests pass after cutover.
- Do not enable aggressive HTML caching for the whole site.

## Cache rule

Create one Cache Rule for static assets:

Expression:

```text
(http.host eq "pastodel.ru" or http.host eq "www.pastodel.ru")
and (
  starts_with(http.request.uri.path, "/_astro/")
  or starts_with(http.request.uri.path, "/images/")
  or starts_with(http.request.uri.path, "/fonts/")
  or http.request.uri.path in {"/favicon.ico" "/favicon.svg" "/robots.txt"}
)
```

Actions:

- Cache eligibility: `Eligible for cache`.
- Edge TTL: `1 month`.
- Browser TTL: `Respect origin` or `1 month`.

Keep HTML routes on the default caching behavior so deploys and rollbacks remain easy to validate.

## Post-cutover verification

Run after registrar nameservers point to Cloudflare and DNS propagation starts:

```bash
curl -I https://pastodel.ru/
curl -I https://pastodel.ru/katalog/
curl --compressed --max-time 20 https://pastodel.ru/katalog/ >/dev/null
curl -H 'Accept-Encoding: identity' --max-time 20 https://pastodel.ru/katalog/ >/dev/null
curl --max-time 20 https://pastodel.ru/images/catalog-hero.jpg >/dev/null
curl -sL https://pastodel.ru/release-meta.json
```

Expected:

- Response headers include `cf-ray`.
- Static asset responses eventually show `cf-cache-status: HIT` after the first request.
- `/release-meta.json` still reports `f8ada754e445d4213fa8e3499188fe3a21365e04` until the next deploy.
- `/katalog/` and product pages open on mobile without timeout.

## Rollback

If Cloudflare causes SSL or routing errors:

1. Set DNS records to DNS-only in Cloudflare, or revert nameservers at the registrar.
2. Keep the server unchanged.
3. Verify direct origin:

```bash
curl -I https://pastodel.ru/
curl -sL https://pastodel.ru/release-meta.json
```

