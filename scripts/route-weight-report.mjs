#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { dist: 'dist', routes: ['/', '/katalog/', '/partneram/', '/horeca/'], output: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!val || val.startsWith('--')) continue;
    if (key === '--dist') args.dist = val;
    if (key === '--routes') args.routes = val.split(',').map((v) => v.trim()).filter(Boolean);
    if (key === '--output') args.output = val;
    if (key === '--top') args.top = Number(val) || 10;
  }
  args.top ??= 10;
  return args;
}

function routeToHtmlFile(distDir, route) {
  const clean = route.startsWith('/') ? route.slice(1) : route;
  if (!clean) return path.join(distDir, 'index.html');
  const normalized = clean.endsWith('/') ? clean.slice(0, -1) : clean;
  return path.join(distDir, normalized, 'index.html');
}

function parseAssetPaths(html) {
  const assets = new Set();
  const attrRegex = /\b(?:src|href)=["']([^"']+)["']/gi;

  let m;
  while ((m = attrRegex.exec(html)) !== null) {
    const raw = m[1] || '';
    if (!raw.startsWith('/')) continue;
    if (raw.startsWith('//')) continue;
    assets.add(raw.split('?')[0].split('#')[0]);
  }

  return [...assets].filter((asset) => {
    return /\.(css|js|mjs|webp|avif|png|jpe?g|svg|ico|woff2?|ttf|otf)$/i.test(asset);
  });
}

function parseCssAssetPaths(css) {
  const assets = new Set();
  const urlRegex = /url\(([^)]+)\)/gi;
  let m;
  while ((m = urlRegex.exec(css)) !== null) {
    const raw = (m[1] || '').trim().replace(/^['"]|['"]$/g, '');
    if (!raw.startsWith('/')) continue;
    if (raw.startsWith('//')) continue;
    assets.add(raw.split('?')[0].split('#')[0]);
  }
  return [...assets];
}

function classifyAsset(assetPath) {
  if (assetPath.endsWith('.css')) return 'css';
  if (/\.(js|mjs)$/i.test(assetPath)) return 'js';
  if (/\.(woff2?|ttf|otf)$/i.test(assetPath)) return 'fonts';
  if (/\.(webp|avif|png|jpe?g|svg|ico)$/i.test(assetPath)) return 'images';
  return 'other';
}

function statSize(absPath) {
  try {
    return fs.statSync(absPath).size;
  } catch {
    return null;
  }
}

function toKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

function run() {
  const args = parseArgs(process.argv);
  const distDir = path.resolve(args.dist);
  const report = {
    generated_at: new Date().toISOString(),
    dist_dir: distDir,
    routes: []
  };

  for (const route of args.routes) {
    const htmlFile = routeToHtmlFile(distDir, route);
    if (!fs.existsSync(htmlFile)) {
      report.routes.push({ route, error: `Missing ${htmlFile}` });
      continue;
    }

    const html = fs.readFileSync(htmlFile, 'utf8');
    const htmlBytes = Buffer.byteLength(html);
    const assetPaths = parseAssetPaths(html);

    const assets = [];
    const seen = new Set(assetPaths);
    const queue = [...assetPaths];
    const byType = { html: htmlBytes, css: 0, js: 0, images: 0, fonts: 0, other: 0 };

    while (queue.length > 0) {
      const asset = queue.shift();
      const abs = path.join(distDir, asset.replace(/^\//, ''));
      const size = statSize(abs);
      if (size === null) continue;
      const type = classifyAsset(asset);
      byType[type] += size;
      assets.push({ path: asset, type, bytes: size, kb: toKb(size) });

      if (type === 'css') {
        try {
          const css = fs.readFileSync(abs, 'utf8');
          const cssAssets = parseCssAssetPaths(css);
          for (const cssAsset of cssAssets) {
            if (!/\.(css|js|mjs|webp|avif|png|jpe?g|svg|ico|woff2?|ttf|otf)$/i.test(cssAsset)) continue;
            if (seen.has(cssAsset)) continue;
            seen.add(cssAsset);
            queue.push(cssAsset);
          }
        } catch {
          // Ignore unreadable generated assets while keeping route weight reporting best-effort.
        }
      }
    }

    assets.sort((a, b) => b.bytes - a.bytes);

    const totalBytes = Object.values(byType).reduce((acc, v) => acc + v, 0);
    report.routes.push({
      route,
      request_count: 1 + assets.length,
      totals_bytes: {
        html: byType.html,
        css: byType.css,
        js: byType.js,
        images: byType.images,
        fonts: byType.fonts,
        other: byType.other,
        total: totalBytes
      },
      totals_kb: {
        html: toKb(byType.html),
        css: toKb(byType.css),
        js: toKb(byType.js),
        images: toKb(byType.images),
        fonts: toKb(byType.fonts),
        other: toKb(byType.other),
        total: toKb(totalBytes)
      },
      largest_assets: assets.slice(0, args.top),
      assets
    });
  }

  const serialized = JSON.stringify(report, null, 2);
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), serialized + '\n', 'utf8');
    console.log(`[route-weight-report] Wrote ${path.resolve(args.output)}`);
  } else {
    console.log(serialized);
  }
}

run();
