# Frontend Image Strategy (Phase)

## Scope and safety limits
- This phase optimizes frontend payload only.
- Forms are out of scope.
- Compatibility artifacts on production server must remain untouched.
- No clean-slate redeploy assumptions.

## Context-based image rules

### Catalog/product cards (highest volume)
- Render only one active image element per card.
- Keep Home/HoReCa variants as switchable `src/srcset` values on the same `<img>`.
- Use constrained responsive widths: `240, 320, 400, 520`.
- Use card quality profile: `quality=58`, `format=webp`.
- Keep `loading="lazy"`, `decoding="async"`.

### Homepage card grid
- Use `astro:assets` pipeline instead of large static `/images/*` card references.
- Use constrained responsive widths: `220, 300, 380, 460`.
- Use more aggressive card quality profile: `quality=56`.

### Hero and intro imagery
- Keep hero eager only for true above-the-fold element.
- Use responsive widths instead of always shipping a large variant.
- Current profile:
  - home hero: widths `360, 520, 760, 960`, `quality=66`
  - catalog/page intro blocks: widths up to `920/1080`, `quality=72`

### Product detail image
- Keep larger viewport coverage than cards.
- Use widths `420, 620, 820, 1080`, `quality=72`.

## Measurement tooling

Route-level transfer estimate script:

```bash
node scripts/route-weight-report.mjs \
  --dist dist \
  --routes /,/katalog/,/partneram/,/horeca/ \
  --output docs/baselines/perf-after-estimate.json
```

Notes:
- The script estimates one selected asset per element from rendered HTML (`src`/`href`) and CSS `url(...)` dependencies.
- It does not emulate real browser cache reuse or viewport-specific `srcset` choice.
- Use it for controlled relative comparison between builds, not as an exact live RUM metric.

## Baseline comparison used in this phase

`before` source:
- live production measurements from the previous audit snapshot (2026-04-10).

`previous after` source:
- local `dist` build estimate after the first image pass.

`stabilized after` source:
- local `dist` build estimate after homepage stabilization + build/smoke hardening.

| Route | Before (live) | Previous After | Stabilized After | Delta vs Before |
|---|---:|---:|---:|---:|
| `/` | 381,360 B | 407,292 B | 380,383 B | -977 B |
| `/katalog/` | 1,569,494 B | 1,362,855 B | 1,362,855 B | -206,639 B |
| `/partneram/` | 514,082 B | 458,861 B | 458,861 B | -55,221 B |
| `/horeca/` | 521,237 B | 463,245 B | 463,245 B | -57,992 B |

Interpretation:
- Main target route (`/katalog/`) is materially reduced.
- Business landing routes are reduced.
- Homepage is back to baseline level in static estimate after switching home cards to lighter curated assets.

## Post-canary validation checklist
Run immediately after image-only canary deploy:

1. Compare route transfer totals for `/` and `/katalog/` against this baseline model.
2. Capture top 10 largest image requests on `/` and `/katalog/`.
3. Confirm request count does not increase unexpectedly on `/`.
4. Confirm no visual regression on hero and card blocks (desktop + mobile).
5. Confirm compatibility paths still resolve (`/_astro/*`, `/js/app.js`, `/fonts/*`) and are untouched in this phase.
6. Keep compatibility artifact cleanup disabled; only evaluate cleanup in a separate evidence-backed phase.

## Regression guardrails
- Do not reintroduce two simultaneously rendered Home/HoReCa card images.
- For any new card/grid image, set explicit `widths`, `sizes`, and card-level `quality`.
- Avoid raw large `/images/*.webp` usage for repeated card grids.
- Keep only true above-the-fold media as eager/high priority.
