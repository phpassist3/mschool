import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * Единая воронка для всех ошибок, всплывших из роутов / middleware.
 *
 * - Известные `AppError` сериализуются с нужным статусом и кодом,
 *   чтобы фронт мог надёжно ветвиться по полю `error`.
 * - Всё остальное считаем неожиданной ошибкой: пишем в лог с полным
 *   контекстом и отдаём наружу общий 500. Стектрейсы и детали SQL
 *   клиенту никогда не уходят.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
};
