# Baseline manifests

This directory stores point-in-time manifest baselines used for safe cleanup planning.

Files:
- `local-<timestamp>.tsv` — checksum manifest from local `dist`.
- `server-<timestamp>.tsv` — checksum manifest from active server release.
- `classification-<timestamp>.md` — canonical/compatibility/unknown classification report.
- `perf-before.json` — route payload snapshot used as pre-optimization reference.
- `perf-after-estimate.json` — route payload estimate from current local build.
- `perf-after-stabilized-estimate.json` — route payload estimate after homepage/build/smoke stabilization pass.

Rules:
- Do not use these files to delete artifacts automatically.
- Any cleanup plan must reference a baseline report and recent access-log evidence.
- Compatibility artifacts (`_astro`, `js`, `fonts`) remain protected until explicit retention decision.
