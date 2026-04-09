# Handoff

## Текущее состояние

В новом проекте `pastodel_new` завершён рабочий этап каталога:
- есть `/katalog/`
- есть dynamic product routes для retail и HoReCa
- все SKU-страницы генерируются из typed data layer
- сборка подтверждена `npm run build`

## Что сделано

- Data model и utilities:
  - `src/data/product-types.ts`
  - `src/data/products.ts`
  - `src/data/product-assets.ts`
  - `src/data/product-utils.ts`
- Компоненты каталога/товара:
  - `src/components/catalog/CatalogAudienceSwitch.astro`
  - `src/components/catalog/ProductCard.astro`
  - `src/components/product/ProductDetailPage.astro`
  - `src/components/product/ProductImage.astro`
  - `src/components/product/ProductMeta.astro`
  - `src/components/product/PrepTabs.astro`
- Страницы:
  - `src/pages/katalog/index.astro`
  - `src/pages/katalog/[slug].astro`
  - `src/pages/katalog/horeca/[slug].astro`
- Ассеты:
  - `src/assets/products/*` (каталог + retail/horeca packshot изображения)
- UI-стили для новых страниц добавлены в `src/styles/global.css`.

## Что не сделано

- Остальные целевые страницы (B2B/content/legal) еще не реализованы.
- Не проведён финальный визуальный regression-аудит по всем каталогным страницам в браузере на всех брейкпоинтах.
- Не выполнялись deploy/rollout действия (по задаче и не должны).

## Риски

- Возможны локальные визуальные отличия от live на уровне мелких отступов/типографики.
- Если часть live-данных меняется вне HTML (внешний источник), потребуется дополнительная синхронизация data layer.

## Следующий шаг

1. Провести браузерный visual QA `/katalog/` и SKU-страниц (desktop/tablet/mobile) против live.
2. Довести каталог до финального совпадения и зафиксировать правки.
3. Перейти к следующему этапу: `/partneram/`, `/horeca/`, `/gde-kupit/` и остальные страницы из списка.
