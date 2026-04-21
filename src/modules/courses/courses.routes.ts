import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { limitCourseCreation } from '../../middleware/rateLimitCourses';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { coursesController } from './courses.controller';
import {
  courseIdParams,
  createCourseSchema,
  listCoursesQuery,
} from './courses.schemas';

/**
 * Роуты курсов.
 *
 * Порядок middleware намеренный:
 *   1. requireAuth            — нет идентичности — дальше не идём.
 *   2. limitCourseCreation    — отклоняем превысивших квоту до
 *                               валидации и записи чего-либо.
 *   3. validate               — дешёвая stateless-проверка payload.
 *   4. asyncHandler(handler)  — запускаем сам контроллер.
 */
export const coursesRouter = Router();

coursesRouter.post(
  '/',
  requireAuth,
  limitCourseCreation,
  validate(createCourseSchema),
  asyncHandler(coursesController.create),
);

// Чтение и листинг — публичные: в задании не требуется авторизация,
// плюс это позволяет краулерам/превью видеть каталог.
coursesRouter.get(
  '/',
  validate(listCoursesQuery, 'query'),
  asyncHandler(coursesController.list),
);

coursesRouter.get(
  '/:id',
  validate(courseIdParams, 'params'),
  asyncHandler(coursesController.getById),
);

// Удаление — только автору курса. Каскад подчистит уроки/тесты.
coursesRouter.delete(
  '/:id',
  requireAuth,
  validate(courseIdParams, 'params'),
  asyncHandler(coursesController.delete),
);
