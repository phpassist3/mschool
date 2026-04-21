import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

type Part = 'body' | 'query' | 'params';

/**
 * Универсальный валидатор части запроса.
 *
 * Парсит `req.body | query | params` через Zod-схему, отклоняет
 * невалидный вход структурированным 400 и — что важно — записывает
 * уже распарсенное значение обратно в запрос. Контроллеры получают
 * типизированные и приведённые данные (например, query-строки уже
 * числа) и не должны перевалидировать их заново.
 */
export const validate =
  (schema: ZodSchema, part: Part = 'body'): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: result.error.flatten(),
      });
      return;
    }
    (req as unknown as Record<Part, unknown>)[part] = result.data;
    next();
  };
