import { RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

/**
 * Ограничивает создание курсов: не более COURSE_RATE_LIMIT_MAX штук
 * за скользящее окно COURSE_RATE_LIMIT_WINDOW_MINUTES.
 *
 * Сознательно читаем из источника истины (таблицы `courses`), а не
 * из in-memory счётчика. Компромиссы:
 *
 *   + Переживает рестарты и горизонтальное масштабирование (не нужны
 *     sticky-сессии, счётчики не дрейфуют между инстансами).
 *   + Нет лишней инфраструктуры (Redis и пр.) ради правила 3 rps/час.
 *
 *   - На каждое создание уходит один индексный COUNT. Индекс
 *     (author_id, created_at) в schema.prisma делает его дешёвым;
 *     при росте RPS можно положить счётчик в Redis (INCR + TTL).
 *
 * Должен выполняться ПОСЛЕ `requireAuth`, чтобы `req.user` был задан.
 */
export const limitCourseCreation: RequestHandler = async (req, _res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    const windowStart = new Date(Date.now() - env.COURSE_RATE_LIMIT_WINDOW_MINUTES * 60_000);
    const count = await prisma.course.count({
      where: { authorId: userId, createdAt: { gte: windowStart } },
    });

    if (count >= env.COURSE_RATE_LIMIT_MAX) {
      return next(
        new AppError(
          429,
          `Course creation limit reached: max ${env.COURSE_RATE_LIMIT_MAX} per ${env.COURSE_RATE_LIMIT_WINDOW_MINUTES} minutes`,
          'RATE_LIMIT_EXCEEDED',
        ),
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};
