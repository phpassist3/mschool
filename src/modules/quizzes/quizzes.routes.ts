import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { quizzesController } from './quizzes.controller';
import {
  attemptSchema,
  lessonIdParams,
  upsertQuizSchema,
} from './quizzes.schemas';

/**
 * Роуты тестов.
 *
 * Смонтированы в app.ts на `/api/lessons/:lessonId/quiz`. Это более
 * плоская форма, чем `/courses/:courseId/lessons/:lessonId/...` —
 * когда известен `lessonId`, курс легко достать через join в сервисе.
 *
 * `mergeParams: true` нужен, чтобы :lessonId из родительского
 * префикса был виден хендлерам.
 */
export const quizzesRouter = Router({ mergeParams: true });

// Публичное чтение — без correctIndex. Отдельно 404, если теста нет.
quizzesRouter.get(
  '/',
  validate(lessonIdParams, 'params'),
  asyncHandler(quizzesController.get),
);

// Создать/заменить тест — только автор курса. Принимаем сразу пакет
// вопросов, внутри сервиса они заменяются атомарно в транзакции.
quizzesRouter.put(
  '/',
  requireAuth,
  validate(lessonIdParams, 'params'),
  validate(upsertQuizSchema),
  asyncHandler(quizzesController.upsert),
);

quizzesRouter.delete(
  '/',
  requireAuth,
  validate(lessonIdParams, 'params'),
  asyncHandler(quizzesController.delete),
);

// Попытка прохождения: принимаем массив ответов, в ответ — score и
// массив правильных индексов (показываем только после сабмита).
quizzesRouter.post(
  '/attempt',
  validate(lessonIdParams, 'params'),
  validate(attemptSchema),
  asyncHandler(quizzesController.attempt),
);
