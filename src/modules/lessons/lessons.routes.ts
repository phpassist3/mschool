import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { lessonsController } from './lessons.controller';
import {
  createLessonSchema,
  lessonCourseParams,
  listLessonsQuery,
} from './lessons.schemas';

/**
 * Уроки — это sub-ресурс курса, поэтому роутер монтируется на
 * `/api/courses/:courseId/lessons` в app.ts. Флаг `mergeParams: true`
 * нужен, чтобы дочерний роутер видел `:courseId` из родительского.
 */
export const lessonsRouter = Router({ mergeParams: true });

lessonsRouter.post(
  '/',
  requireAuth,
  validate(lessonCourseParams, 'params'),
  validate(createLessonSchema),
  asyncHandler(lessonsController.create),
);

lessonsRouter.get(
  '/',
  validate(lessonCourseParams, 'params'),
  validate(listLessonsQuery, 'query'),
  asyncHandler(lessonsController.list),
);
