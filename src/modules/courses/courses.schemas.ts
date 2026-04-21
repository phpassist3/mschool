import { z } from 'zod';

/**
 * Контракты модуля courses на уровне HTTP.
 *
 * `trim()` на строках не даёт ведущим/хвостовым пробелам просочиться
 * в листинги и поиск. Верхние границы — чтобы один пользователь
 * не раздул отдельную строку (и место на диске) без меры.
 */

export const createCourseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

// `coerce` позволяет принимать числа из query-строк (где они
// приходят как строки) и отдавать в хендлер уже честный `number`.
// `max(100)` ограничивает размер страницы — недобросовестный клиент
// не сможет запросить всю таблицу одним запросом.
export const listCoursesQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const courseIdParams = z.object({
  id: z.string().uuid(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
