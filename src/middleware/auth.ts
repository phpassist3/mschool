import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

/**
 * Минимальный набор полей, который кладём в JWT. `sub` по
 * соглашению — идентификатор пользователя; `email` кладём, чтобы
 * downstream-хендлеры могли логировать/отвечать без лишнего
 * похода в БД в типичном случае.
 */
export interface AuthPayload {
  sub: string;
  email: string;
}

// Сообщаем TypeScript о поле `req.user` во всём кодовом базисе.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Защищает эндпоинты, требующие аутентифицированного пользователя.
 *
 * Читает `Authorization: Bearer <jwt>`, проверяет подпись по
 * `JWT_SECRET` и кладёт расшифрованный payload в `req.user`. Любое
 * искажение или истечение — 401 с единой формой ответа.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid Authorization header', 'UNAUTHORIZED'));
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthPayload;
    req.user = { sub: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};
