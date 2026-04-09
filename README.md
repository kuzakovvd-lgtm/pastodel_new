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
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-preview.sh
DEPLOY_HOST=<server-host> DEPLOY_USER=root scripts/deploy-preview.sh --apply
```

Notes:
- `deploy-preview.sh` by default runs in dry-run mode.
- deploy target is a separate root (`/var/www/pastodel_new`) and does not switch live traffic.

## Важно по формам

- Production endpoint отправки форм **не подключён намеренно**, пока не подтвержден API.
- Текущий form layer реализован через безопасный adapter-подход в `src/components/forms/FormRuntime.astro`.
- Точка интеграции отмечена TODO: `window.__PASTODEL_FORMS_ENDPOINT`.

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
