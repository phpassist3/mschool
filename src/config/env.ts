import 'dotenv/config';
import { z } from 'zod';

/**
 * Централизованный и провалидированный взгляд на process.env.
 *
 * Парсинг выполняется ровно один раз при старте. Любая ошибка
 * конфигурации (отсутствует секрет, невалидный URL, неизвестный
 * уровень логирования) немедленно роняет процесс с понятным
 * сообщением — гораздо лучше, чем узнать об этом через пару часов
 * на первом же запросе.
 *
 * Во всём остальном коде импортируем `env` вместо прямого чтения
 * process.env — так форма конфигурации типизирована, а у значений
 * по умолчанию ровно один источник правды.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET должен быть не короче 16 символов'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  COURSE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  COURSE_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
});

export const env = schema.parse(process.env);
