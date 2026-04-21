# mschool — LMS backend

REST API для небольшой LMS-платформы: пользователи, курсы, уроки.
Стек: **Node.js 20 · TypeScript · Express · Prisma · PostgreSQL 16**.

Продовый инстанс: <https://mschool.phpassist.dev>.

---

## Возможности

- JWT-авторизация (`/api/auth/register`, `/api/auth/login`).
- Курсы: создание, листинг, получение по `id`.
- Уроки внутри курса: добавление, листинг.
- Валидация входа — Zod (схемы лежат рядом с модулем).
- Пагинация через `?page=&limit=`.
- Структурированные JSON-логи (pino + pino-http) с корреляцией по запросу.
- **Rate-limit: не более 3 курсов на пользователя за 1 час** — параметры в env.

---

## Быстрый запуск

### Вариант 1 — всё в Docker (рекомендуется)

```bash
cp .env.example .env     # обязательно поменяйте JWT_SECRET и пароль БД
docker compose up --build -d
```

API будет слушать на `127.0.0.1:3000` (за reverse proxy). Миграции
Prisma применяются автоматически при старте контейнера `api` командой
`prisma migrate deploy` — она идемпотентна.

### Вариант 2 — локально для разработки

Требуется Node.js 20+ и PostgreSQL.

```bash
cp .env.example .env
docker compose up -d db          # поднять только БД

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev                      # ts-node-dev, hot reload
```

### Переменные окружения

| Переменная                         | По умолчанию | Назначение                                   |
| ---------------------------------- | ------------ | -------------------------------------------- |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` | —         | Реквизиты БД внутри compose-сети             |
| `JWT_SECRET`                       | —            | Секрет подписи JWT (не короче 16 символов)   |
| `JWT_EXPIRES_IN`                   | `1d`         | Время жизни access-токена                    |
| `LOG_LEVEL`                        | `info`       | `fatal` \| `error` \| `warn` \| `info` \| …  |
| `COURSE_RATE_LIMIT_MAX`            | `3`          | Макс. курсов на пользователя в окне          |
| `COURSE_RATE_LIMIT_WINDOW_MINUTES` | `60`         | Размер окна ограничения (мин.)               |
| `API_HOST_PORT`                    | `3000`       | Порт API на хосте (привязан к 127.0.0.1)     |

---

## API

Защищённые эндпоинты требуют `Authorization: Bearer <JWT>`.

### Auth

```
POST /api/auth/register   { "email", "password" }   -> 201 { user, token }
POST /api/auth/login      { "email", "password" }   -> 200 { user, token }
```

### Courses

```
POST /api/courses              (auth)  { "title", "description" }   -> 201 Course
GET  /api/courses?page=1&limit=20                                    -> 200 { items, meta }
GET  /api/courses/:id                                                -> 200 Course | 404
```

Превышение лимита — `429 RATE_LIMIT_EXCEEDED`.

### Lessons

```
POST /api/courses/:courseId/lessons   (auth, только автор курса)
     { "title", "content" }                         -> 201 Lesson
GET  /api/courses/:courseId/lessons?page=1&limit=50 -> 200 { items, meta }
```

### Пример `curl`

```bash
# 1) регистрация
curl -s -X POST https://mschool.phpassist.dev/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"u@example.com","password":"password123"}'

TOKEN=<JWT из ответа>

# 2) создать курс
curl -s -X POST https://mschool.phpassist.dev/api/courses \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"title":"TS 101","description":"Intro to TypeScript"}'

# 3) добавить урок
curl -s -X POST https://mschool.phpassist.dev/api/courses/<COURSE_ID>/lessons \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"title":"Types","content":"..."}'
```

---

## Структура проекта

```
src/
├── app.ts                  Express-приложение (middleware + роутеры)
├── index.ts                bootstrap + graceful shutdown
├── config/env.ts           парсинг и валидация ENV (Zod)
├── db/prisma.ts            единственный PrismaClient на процесс
├── errors/AppError.ts      доменная ошибка со статусом и кодом
├── middleware/             auth · validate · rateLimitCourses · errorHandler
├── utils/                  logger · asyncHandler
└── modules/
    ├── auth/               routes → controller → service → repository → schemas
    ├── courses/            то же самое
    └── lessons/            то же самое
prisma/schema.prisma        модели User, Course, Lesson
```

Слои: `routes` (HTTP-адаптер) → `controller` (IO) → `service`
(бизнес-правила, доменные ошибки) → `repository` (Prisma). Бизнес-логика
не завязана на Express и легко тестируется в изоляции.

---

## Описание решения

### Почему такая архитектура?

- **Модули по доменам** (`auth`, `courses`, `lessons`), а не плоские
  папки `controllers/`, `services/`. Каждый модуль растёт «под одной
  крышей» вместе со своими схемами, маршрутами и DTO — удобно вносить
  изменения локально и понятно, где что лежит.
- **4 слоя (routes · controller · service · repository).** HTTP-специфика
  изолирована в контроллере; доменные инварианты («только автор может
  добавить урок», «курс должен существовать», лимит на создание) —
  в сервисе и покрываются unit-тестами без поднятия Express; работа
  с БД — в репозитории, можно подменить ORM или добавить кеш.
- **Zod на входе.** Одна схема даёт и TS-тип (`z.infer`), и runtime-проверку,
  плюс сразу коэрсит query-строки в нужные типы. Контроллеры и сервисы
  работают с уже валидными данными.
- **Rate-limit по таблице `courses`, а не in-memory.** Ограничение переживает
  рестарт контейнера, корректно работает при горизонтальном масштабировании
  и не требует отдельного сервиса. Индекс `(author_id, created_at)`
  делает проверку дешёвой.
- **Prisma** — типобезопасность + миграции из коробки. `prisma migrate deploy`
  в `command:` гарантирует, что схема БД всегда соответствует коду
  (zero-config миграции при деплое).
- **Единая доменная ошибка `AppError`** + централизованный `errorHandler`.
  Контроллеры/сервисы не знают про HTTP-коды напрямую, фронт получает
  стабильный JSON вида `{ error, message }`.
- **Stateless.** Сессий нет — только JWT. Это даёт горизонтальное
  масштабирование «из коробки».

### Узкие места

1. **`COUNT(*)` на каждое создание курса.** В текущих объёмах это дёшево
   (индекс `(author_id, created_at)`), но при росте RPS счётчик стоит
   вынести в Redis (`INCR` + `EXPIRE`).
2. **Offset-пагинация.** `skip/take` ок для первых страниц; при глубокой
   пагинации — деградация. Лечение — keyset-пагинация по
   `(created_at, id)`.
3. **Один процесс Node, CPU-bound задачи.** Транскод видео, тяжёлая
   обработка контента должны жить в отдельных воркерах через очередь.
4. **JWT без refresh и revocation.** Компрометированный токен живёт
   до истечения `expiresIn`. Для продакшена — короткий access + refresh
   с ротацией и таблица отзыва.
5. **Нет троттлинга `/login` и `/register`.** Brute-force защиту проще
   всего навесить на edge (nginx `limit_req`) или промежуточным
   `express-rate-limit`.
6. **Нет E2E-тестов.** Код покрывается unit-тестами тривиально, но
   интеграционные/E2E-прогоны на реальной БД стоит добавить в CI.

### Как масштабировать

- **Горизонтально за балансером.** Приложение stateless → N реплик
  за nginx/HAProxy. JWT без серверных сессий это поддерживает сразу.
- **БД.** Сначала — вертикальный апгрейд + read-replica для `GET`
  (листинги). Дальше — разделение: метаданные в Postgres, контент
  уроков (длинные тексты, медиа) — в object storage (S3-совместимое),
  в БД только ссылки.
- **Кеш.** Листинги курсов отлично кешируются (Redis + короткий TTL
  + инвалидация на `POST /courses`). Rate-limit туда же.
- **Фоновые задачи.** Поиск-индексация, уведомления, транскод —
  BullMQ/Rabbit/SQS + отдельные воркеры.
- **Поиск.** Когда понадобится полнотекст по курсам/урокам — `tsvector`
  + триггер, на следующем шаге OpenSearch.
- **Обсервабилити.** Логи уже структурированные; в продакшен — OTel-трейсинг,
  Prometheus-метрики (RED/USE), алерты на 5xx и p95.
- **CI/CD.** Lint + typecheck + тесты + `prisma migrate deploy` в пайплайне;
  деплой blue-green / canary, чтобы миграции и код катились согласованно.
