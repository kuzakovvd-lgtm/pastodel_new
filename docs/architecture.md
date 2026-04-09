# Архитектура `pastodel_new`

## Цели

- Воспроизвести live `https://pastodel.ru` по URL-структуре, контенту, дизайну и ключевому UX-поведению.
- Избежать legacy-архитектуры и держать код компонентным и поддерживаемым.

## Технологии

- Astro 5 (static output)
- TypeScript
- Vite pipeline (bundled client scripts + hashed build assets)

## Слои проекта

- `src/pages/*` — file-based routing (включая будущие dynamic product routes)
- `src/layouts/BaseLayout.astro` — SEO-обвязка, skip link, общий каркас
- `src/components/*` — Header/Footer и далее секционные компоненты
- `src/data/*` — typed-контент для навигации, SKU, секций
- `src/styles/global.css` — global tokens + базовые стили

## JS-стратегия

- Только необходимый client-side JS.
- Сейчас реализовано: мобильное меню и compact header.
- Следующие шаги: tabs, audience switch, forms, accordion (минимальными модулями).

## Кеширование и ассеты

- Build-ассеты Astro (`/_astro/*`) hashed по умолчанию.
- Изображения и шрифты постепенно переносятся локально, без зависимости от старого кода.
- Отдельно будет зафиксирована production cache strategy в `docs/deploy.md`.
