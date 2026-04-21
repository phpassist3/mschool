import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Обёртка для асинхронных хендлеров Express: проброшенные (или
 * отклонённые) промисы уходят в централизованный error-middleware,
 * а не тонут как unhandledRejection.
 *
 * Express 4 нативно не умеет в async-хендлеры; без этой обёртки
 * пришлось бы в каждом контроллере писать собственный try/catch.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
