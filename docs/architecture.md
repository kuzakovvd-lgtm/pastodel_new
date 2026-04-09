# Архитектура `pastodel_new`

## Цели

- Воспроизвести live `https://pastodel.ru` по URL-структуре, контенту, дизайну и ключевому UX-поведению.
- Избежать legacy-архитектуры и держать код компонентным и поддерживаемым.

## Технологии

- Astro 5 (static output)
- TypeScript
- Vite pipeline (bundled client scripts + hashed build assets)

## Слои проекта

- `src/pages/*` — file-based routing
- `src/layouts/BaseLayout.astro` — SEO-обвязка, skip link, общий каркас
- `src/components/*` — UI-компоненты
- `src/data/*` — typed-контент для навигации и SKU
- `src/assets/*` — локальные изображения под `astro:assets`
- `src/styles/global.css` — global tokens + общие стили

## Каталог и product routes

- `/katalog/`
- `/katalog/[slug]/` (retail)
- `/katalog/horeca/[slug]/` (horeca)
- `getStaticPaths()` генерируется из `src/data/products.ts`.

## Page section system

- `src/components/common/PageIntro.astro` — hero/intro + breadcrumbs + CTA.
- `src/components/common/Breadcrumbs.astro` — единый breadcrumb блок.
- `src/components/common/SectionHead.astro` — стандартизированный заголовок секций.
- Повторяемые блоки страниц реализуются composable-компонентами + общими CSS-классами (`simple-grid`, `split-grid`, `info-card`).

## Form architecture

- Client runtime: `src/components/forms/FormRuntime.astro`.
- Реализовано:
  - базовая валидация required/email/phone
  - prefill через query params (`data-prefill-field`, `data-query-param`, `data-query-map`)
  - prefill через CTA-кнопки (`data-prefill-target`, `data-prefill-value`)
  - honeypot-поле
  - loading/success/error состояния
  - margin calculator (`data-margin-calculator`)
  - partner gateway step flow/scenario switch (`data-gateway-form-shell`)
- Endpoint adapter:
  - текущий placeholder: `window.__PASTODEL_FORMS_ENDPOINT`
  - если endpoint не задан, используется безопасный stub-режим без угадывания прод endpoint
  - место интеграции помечено TODO

## Реализованные страницы этапа

- `/partneram/`
- `/horeca/`
- `/gde-kupit/`
- `/o-kompanii/`
- `/otzyvy/`
- `/kontakty/`
- `/dokumenty/`
- `/novosti/`
- `/proizvodstvo-i-kachestvo/`
- `/stat-partnerom/`
- `/politika-konfidentsialnosti/`
- `/soglasie-na-obrabotku-dannyh/`

## Кеширование и ассеты

- Build-ассеты Astro (`/_astro/*`) hashed по умолчанию.
- Product images и page intro images перенесены в `src/assets/*`.
- Для deploy предполагается immutable cache для `/_astro/*` и короткий cache для HTML (см. `docs/deploy.md`).

## Подтверждение данных и ограничения

- Контент и структура страниц восстановлены по текущему live-снапшоту (dist-артефакт).
- Новости/документы воспроизведены как минимально наполненные каркасные разделы, без выдумывания записей.
- Legal-страницы сохранены как legal-заготовки и требуют финальной юрпроверки перед боевым запуском.

## UI parity policy

- При визуальной доводке приоритет у shared-стилей и reusable блоков, а не у page-specific хака.
- Critical/Medium расхождения закрываются в первую очередь; Low правятся только если не усложняют поддержку.
- Авто-сравнение по возможности выполняется через Playwright, при ограничениях среды допускается structured manual QA с явной фиксацией ограничений в `docs/visual-qa.md`.
