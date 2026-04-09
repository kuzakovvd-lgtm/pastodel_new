# Progress Log

## Статус

Текущий этап: `Visual QA (priority routes) выполнен, critical/medium расхождения закрыты`.

## Housekeeping

- Проверен локальный файл `public/images/product-paelya.webp`.
- Файл **используется** на текущей главной (`src/pages/index.astro`) и не является мусором.
- Локальная несвязанная модификация была откатана (`git restore`), чтобы исключить случайный шум в коммитах.
- Для каталога и новых страниц используется современная стратегия через `src/assets/*` и `astro:assets`.

## Сделано в этом этапе

- Реализованы обязательные страницы:
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
- Добавлены reusable компоненты:
  - `src/components/common/Breadcrumbs.astro`
  - `src/components/common/PageIntro.astro`
  - `src/components/common/SectionHead.astro`
- Реализован form runtime слой:
  - `src/components/forms/FormRuntime.astro`
  - валидация, prefill, honeypot, loading/success/error
  - margin calculator
  - partner gateway step flow + scenario switching
- Добавлены page intro assets:
  - `src/assets/page-intro/*`
- Расширены глобальные стили для новых секций/форм/гридов (`src/styles/global.css`).

## Формы и интерактив

Готово:
- `/partneram/` форма заявки
- `/horeca/` форма заявки
- `/kontakty/` форма обращения
- `/stat-partnerom/` gateway form (3 сценария + шаги)
- prefill из query params и CTA кнопок
- phone normalization/mask
- калькулятор маржи на `/partneram/` и `/horeca/`

Ограничение:
- Production endpoint форм **не подключён**, используется безопасный adapter-placeholder.

## Проверено

- `npm run build` (успешно)
- Статическая генерация подтверждает все реализованные маршруты.

## Visual QA (этот этап)

- Выполнено structured визуальное сравнение приоритетных страниц:
  - `/`, `/katalog/`, `/katalog/karbonara/`, `/katalog/horeca/karbonara/`, `/partneram/`, `/horeca/`, `/stat-partnerom/`, `/kontakty/`.
- Critical/Medium исправления:
  - главная перестроена под baseline-порядок секций live,
  - добавлен блок «Попробуйте ещё» на product routes,
  - выровнены desktop-сетки карточек,
  - скорректирована hero-композиция главной,
  - добавлен `focus-visible` accessibility baseline.
- Отчёт: `docs/visual-qa.md`.

## Что осталось

- Low-level polish: точный spacing/typography pass для максимального визуального совпадения.
- Финальный cross-page manual QA (включая вторичный приоритет страниц).
- Pre-deploy smoke pass перед деплоем (без переключения домена на текущем этапе).

## Риски

- Часть live-разделов (`novosti`, `dokumenty`, legal) является каркасной/минимальной — перенос выполнен честно, без выдуманного наполнения.
- До подтверждения backend API формы работают через placeholder adapter и не отправляют данные в production endpoint.
