# Deploy Plan (safe, without touching old live)

## Принцип

Новый сайт деплоится в **отдельную папку** на сервере. Текущий live в старой директории не изменяется.

## Предложение по структуре на сервере

- Текущий live: `/var/www/pastodel_current` (пример)
- Новый проект: `/var/www/pastodel_new`
- Релизы нового проекта:
  - `/var/www/pastodel_new/releases/<timestamp>`
  - `/var/www/pastodel_new/current` -> symlink на активный релиз

## Базовый поток деплоя

1. Собрать проект локально/в CI: `npm ci && npm run build`.
2. Передать `dist/` в новую release-папку.
3. Проверить новый сайт по отдельному hostname или временной location в nginx.
4. Только после QA переключить routing/host на новый `current`.

## Safe rollout

- Шаг 1: deploy в изолированную папку.
- Шаг 2: smoke-тесты по preview URL.
- Шаг 3: ручная проверка SEO/accessibility/responsive/forms.
- Шаг 4: controlled switch (nginx change + reload).

## Rollback

- Держать предыдущий release.
- При проблеме вернуть symlink `current` на прошлый релиз.
- Перезагрузить nginx.

## Важно

- Не хранить SSH ключи/секреты в репозитории.
- Не удалять старый live до полного принятия нового сайта.

## Pre-Deploy Baseline Checklist (без деплоя)

1. Build
- `npm run build` проходит без ошибок.

2. Route coverage
- Проверены ключевые маршруты:
  - `/`, `/katalog/`, `/katalog/[slug]/`, `/katalog/horeca/[slug]/`
  - `/partneram/`, `/horeca/`, `/stat-partnerom/`, `/kontakty/`
  - content/legal pages.

3. Forms placeholder status
- Подтверждено: production endpoint не подключён.
- `FormRuntime` работает через safe adapter placeholder (`window.__PASTODEL_FORMS_ENDPOINT`).

4. SEO basics
- На страницах есть `title`, `description`, `canonical`.
- Базовые Open Graph/Twitter meta через `BaseLayout`.

5. Cache strategy
- `/_astro/*` hashed assets (immutable strategy).
- HTML должен отдаваться с коротким cache TTL.

6. Manual QA points
- Header/nav/sticky/compact behavior.
- Hero/section order/cards/CTA.
- Forms UX (validation/loading/success/error, gateway flow).
- Responsive: desktop/tablet/mobile.
- Accessibility base: skip link, keyboard focus-visible, aria атрибуты.
