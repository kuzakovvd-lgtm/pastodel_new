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

## Локальная проверка каталога

```bash
# каталог
curl -s http://localhost:4321/katalog/ | head -n 20

# retail SKU
curl -s http://localhost:4321/katalog/karbonara/ | head -n 20

# horeca SKU
curl -s http://localhost:4321/katalog/horeca/karbonara/ | head -n 20
```

## Структура

- `src/pages` — маршруты сайта
- `src/layouts` — базовые layout-компоненты
- `src/components` — переиспользуемые UI-блоки
- `src/data` — структурированные данные навигации/контента
- `src/styles` — глобальные стили и дизайн-токены
- `src/assets` — изображения для Astro asset pipeline
- `docs` — архитектура, прогресс, деплой, handoff

Подробности: `docs/architecture.md`.
