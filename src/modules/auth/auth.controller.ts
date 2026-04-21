import { Request, Response } from 'express';
import { authService } from './auth.service';

/**
 * HTTP-адаптеры для сервиса auth.
 *
 * Контроллеры сознательно «тупые»: берут валидированный вход
 * из запроса, делегируют сервису, формируют ответ. Вся обработка
 * ошибок уходит в централизованный errorHandler через asyncHandler.
 */
export const authController = {
  async register(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.register(email, password);
    // 201 Created — создан новый ресурс User.
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email, password);
    res.json(result);
  },
};
