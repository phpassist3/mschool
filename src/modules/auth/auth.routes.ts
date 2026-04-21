import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authController } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schemas';

/**
 * Публичные auth-эндпоинты. Порядок middleware важен:
 *   validate(...)     — отвергаем кривой вход до любой работы.
 *   asyncHandler(...) — пробрасываем async-ошибки в error-handler.
 */
export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
