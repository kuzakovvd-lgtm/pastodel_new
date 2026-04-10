# Pastodel New

Новый чистый проект сайта Pastodel на Astro 5 + TypeScript.

## Локальный запуск

```bash
npm install
npm run dev
```

Сайт: `http://localhost:4321`

## Сборка

```bash
npm run build
npm run preview
```

## Локальная проверка ключевых страниц

```bash
curl -s http://localhost:4321/katalog/ | head -n 20
curl -s http://localhost:4321/partneram/ | head -n 20
curl -s http://localhost:4321/horeca/ | head -n 20
curl -s http://localhost:4321/stat-partnerom/ | head -n 20
curl -s http://localhost:4321/kontakty/ | head -n 20
```

## Pre-deploy scripts

```bash
scripts/check-build.sh
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/pre-deploy-snapshot.sh
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-preview.sh
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-preview.sh --apply
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-safe.sh
BASE_URL=http://127.0.0.1:8081 scripts/smoke-preview.sh
BASE_URL=https://pastodel.ru scripts/validate-deploy.sh
```

Notes:
- `deploy-preview.sh` by default runs in dry-run mode.
- deploy target is a separate root (`/var/www/pastodel_new`) and does not switch live traffic.
- for server-local preview checks, run smoke script over SSH:

```bash
ssh root@<server-host> 'BASE_URL=http://127.0.0.1:8081 bash -s' < scripts/smoke-preview.sh
```

## Важно по формам

- Production endpoint отправки форм задаётся через `PUBLIC_PASTODEL_FORMS_ENDPOINT`.
- Дополнительно можно задать `PUBLIC_PASTODEL_FORMS_TIMEOUT_MS` (по умолчанию `10000`).
- Если endpoint не задан, в production отправка блокируется с честным сообщением о недоступности (без fake success).
- Stub-режим разрешён только в dev или при явном `PUBLIC_ALLOW_FORM_STUB=1` для контролируемой диагностики.
- Runtime override `window.__PASTODEL_FORMS_ENDPOINT` поддерживается для аварийной валидации интеграции без пересборки.
- Успех показывается только при подтверждённом ответе endpoint (см. `docs/forms-backend-contract.md`).

Пример переменных: `.env.example`.

## Release metadata

- После `npm run build` создаётся `dist/release-meta.json`:
  - `releaseId`
  - `gitSha`
  - `gitShaShort`
  - `gitBranch`
  - `buildTimeUtc`

## Структура

- `src/pages` — маршруты сайта
- `src/layouts` — базовые layout-компоненты
- `src/components` — переиспользуемые UI-блоки
- `src/data` — структурированные данные навигации/контента
- `src/styles` — глобальные стили и дизайн-токены
- `src/assets` — изображения для Astro asset pipeline
- `docs` — архитектура, прогресс, деплой, handoff
- `scripts` — служебные скрипты проверки сборки и staging deploy

Подробности: `docs/architecture.md`.

## Safe deploy order (Phase 2)

1. `scripts/check-build.sh`
2. `DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/pre-deploy-snapshot.sh`
3. `DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-safe.sh`
4. If validation fails, rollback immediately using printed command and snapshot metadata.
