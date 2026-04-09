# Progress Log

## Статус

Текущий этап: `Каталог + dynamic product routes (retail/horeca) реализованы`

## Сделано в этом этапе

- Реализована data-driven архитектура каталога и SKU-страниц на Astro.
- Добавлена typed data model:
  - `src/data/product-types.ts`
  - `src/data/products.ts`
  - `src/data/product-assets.ts`
  - `src/data/product-utils.ts`
- Перенесены product-изображения в `src/assets/products` и подключены через `astro:assets`.
- Реализована страница `/katalog/`:
  - hero блока каталога
  - audience switch (дом/HoReCa)
  - grid карточек товаров
  - support/CTA блоки
- Реализованы dynamic routes:
  - `/katalog/[slug]/`
  - `/katalog/horeca/[slug]/`
  - `getStaticPaths()` строится из единого data layer.
- Реализованы product components:
  - `ProductCard`
  - `ProductImage`
  - `ProductMeta`
  - `PrepTabs`
  - `CatalogAudienceSwitch`
  - `ProductDetailPage`
- Добавлены стили под catalog/product UI в `src/styles/global.css`.
- Проверка: `npm run build` проходит успешно.

## Реализованные slug/routes

Retail:
- `/katalog/alfredo-kuritsa/`
- `/katalog/karbonara/`
- `/katalog/mak-end-chiz/`
- `/katalog/vetchina-griby-slivochny-sous/`
- `/katalog/pasta-frikadelki-tomatny-sous/`
- `/katalog/chetyre-syra/`
- `/katalog/kuritsa-pesto-vyalenye-tomaty/`
- `/katalog/primavera/`
- `/katalog/rizotto-rizi-bizi-pesto-zeleny-goroshek/`
- `/katalog/rizotto-griby-slivochny-sous/`
- `/katalog/paelya-kuritsa-ovoshchi/`

HoReCa:
- `/katalog/horeca/alfredo-kuritsa/`
- `/katalog/horeca/karbonara/`
- `/katalog/horeca/mak-end-chiz/`
- `/katalog/horeca/vetchina-griby-slivochny-sous/`
- `/katalog/horeca/pasta-frikadelki-tomatny-sous/`
- `/katalog/horeca/chetyre-syra/`
- `/katalog/horeca/kuritsa-pesto-vyalenye-tomaty/`
- `/katalog/horeca/primavera/`
- `/katalog/horeca/rizotto-rizi-bizi-pesto-zeleny-goroshek/`
- `/katalog/horeca/rizotto-griby-slivochny-sous/`
- `/katalog/horeca/paelya-kuritsa-ovoshchi/`

## Что еще осталось

- Точная доводка визуального соответствия каталога и SKU-страниц по live-сравнению (пиксельные различия, отступы, микротипографика).
- Реализация следующих страниц этапа 4:
  - `/partneram/`, `/horeca/`, `/gde-kupit/`, `/o-kompanii/`, `/otzyvy/`, `/kontakty/`, `/dokumenty/`, `/novosti/`, `/proizvodstvo-i-kachestvo/`, `/stat-partnerom/`, legal pages.
- Контентный QA всех текстов/метрик и точное сравнение с live UI в браузере.

## Ограничения/риски

- Часть текстов в некоторых SKU live-страниц выглядит шаблонно/неоднородно; перенесено как есть из live-снапшота.
- Если на live есть JS-логика, скрытая за серверными условиями/внешними API, она может потребовать отдельного уточнения при следующих этапах.
