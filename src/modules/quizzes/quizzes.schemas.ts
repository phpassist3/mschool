import { z } from 'zod';

/**
 * Контракты модуля тестов. Один тест строго 1:1 к уроку. Вопросы
 * принимаются и возвращаются целым пакетом — простая модель «автор
 * редактирует и сохраняет тест целиком», без отдельного CRUD по
 * вопросам.
 */

// Один вопрос: 2–8 вариантов ответа, один правильный.
// Проверяем, что `correctIndex` не выходит за границы массива.
export const questionSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
    correctIndex: z.number().int().min(0),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex out of range',
    path: ['correctIndex'],
  });

export const upsertQuizSchema = z.object({
  // Проходной балл в процентах. 70% — типичный дефолт для LMS.
  passingScore: z.number().int().min(0).max(100).default(70),
  questions: z.array(questionSchema).min(1).max(50),
});

export const attemptSchema = z.object({
  // Индексы выбранных ответов по порядку вопросов. Разрешаем -1 как
  // «не ответил» — фронт может прислать, если студент пропустил.
  answers: z.array(z.number().int().min(-1)).min(1).max(50),
});

export const lessonIdParams = z.object({
  lessonId: z.string().uuid(),
});

export type UpsertQuizInput = z.infer<typeof upsertQuizSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
