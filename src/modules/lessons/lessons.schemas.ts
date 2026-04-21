import { z } from 'zod';

/**
 * Контракты модуля lessons на уровне HTTP.
 *
 * Контент урока ограничен 100k символов — с запасом под любой
 * реалистичный материал урока, но ограничение есть, чтобы один
 * запрос не породил безграничную строку или лог-строку.
 */

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100_000),
});

export const lessonCourseParams = z.object({
  courseId: z.string().uuid(),
});

// Для DELETE: :courseId приходит от родительского роутера, :id — от нашего.
export const lessonDeleteParams = z.object({
  courseId: z.string().uuid(),
  id: z.string().uuid(),
});

export const listLessonsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
