import express from 'express';
import pinoHttp from 'pino-http';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { coursesRouter } from './modules/courses/courses.routes';
import { lessonsRouter } from './modules/lessons/lessons.routes';
import { logger } from './utils/logger';

/**
 * Фабрика Express-приложения.
 *
 * Экспортируем функцию (а не синглтон), чтобы тесты могли поднимать
 * свежее приложение на каждый набор тестов и не тащили состояние
 * между ними.
 */
export const createApp = () => {
  const app = express();

  // Не рекламируем фреймворк в заголовках ответа.
  app.disable('x-powered-by');

  // Лимит JSON 1 MB — с запасом под текущие payload'ы и дёшевая
  // защита от memory-exhaustion.
  app.use(express.json({ limit: '1mb' }));

  // Структурированные per-request логи с корреляционными id.
  // Каждая строка делит один `req.id` — трассировать один запрос
  // становится тривиально.
  app.use(pinoHttp({ logger }));

  // Дешёвая liveness-проверка для балансировщиков / uptime-мониторов.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Доменные модули — у каждого свои схемы, сервис, репозиторий и роуты.
  app.use('/api/auth', authRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/courses/:courseId/lessons', lessonsRouter);

  // Единый формат 404 для всего, что не совпало с роутами выше.
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
  });

  // Финальный error-middleware — ОБЯЗАТЕЛЬНО последним.
  app.use(errorHandler);

  return app;
};
