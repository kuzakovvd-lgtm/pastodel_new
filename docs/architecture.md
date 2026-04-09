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
- `src/data/*` — typed-контент для навигации, SKU, секций
- `src/assets/*` — локальные изображения под `astro:assets`
- `src/styles/global.css` — global tokens + базовые стили

## Каталог и product routes

- Страница каталога: `/katalog/`.
- Dynamic routes:
  - `/katalog/[slug]/` (retail)
  - `/katalog/horeca/[slug]/` (horeca)
- `getStaticPaths()` генерируется из единого data layer (`src/data/products.ts`).

## Data model (typed)

- `src/data/product-types.ts`
  - `ProductRecord` — общая сущность SKU (slug, category, line, shared flags).
  - `ProductAudienceData` — аудитория-специфичные поля (route, title, weight, SEO, nutrition, prep, CTA и т.д.).
  - `ProductAudience` — `retail | horeca`.
- `src/data/products.ts`
  - Единый массив продуктов `products: ProductRecord[]`.
  - Для каждого SKU хранятся обе аудитории: `retail` и `horeca`.
- `src/data/product-assets.ts`
  - Линковка файлов из `src/assets/products` через `import.meta.glob`.
- `src/data/product-utils.ts`
  - `getProducts`, `getProductBySlug`, `getAudienceData`, `getCategoryLabel`.

## Компоненты каталога

- `src/components/catalog/CatalogAudienceSwitch.astro`
  - Переключение режима каталога "Для дома / Для HoReCa".
  - Минимальный client JS + сохранение выбора в `localStorage`.
- `src/components/catalog/ProductCard.astro`
  - Единая карточка SKU с переключаемыми retail/horeca состояниями.

## Компоненты product page

- `src/components/product/ProductDetailPage.astro`
  - Breadcrumbs, hero, состав, КБЖУ, facts, prep tabs, CTA.
- `src/components/product/ProductImage.astro`
  - Рендер изображения через `astro:assets` с fallback.
- `src/components/product/ProductMeta.astro`
  - Короткие бейджи характеристик.
- `src/components/product/PrepTabs.astro`
  - Табы "Микроволновка/Сковорода" с минимальным JS.

## JS-стратегия

- Только необходимый client-side JS:
  - mobile nav + compact header
  - catalog audience switch
  - prep tabs
- Все скрипты инлайн на уровне компонентов, без legacy `public/js`.

## Кеширование и ассеты

- Build-ассеты Astro (`/_astro/*`) hashed по умолчанию.
- Product images перенесены в `src/assets/products` и обрабатываются через `astro:assets`.
- Для deploy предполагается immutable cache для `/_astro/*` и более короткий cache для HTML (см. `docs/deploy.md`).

## Подтверждение данных и ограничения

- Контент каталога и SKU восстановлен из live-снапшота текущей версии сайта (dist-артефакт live), без использования старой архитектуры/кода.
- На live отсутствуют отдельные B2B-техкарты/PDF внутри SKU-страниц — это отражено как факт, не как пропуск.
