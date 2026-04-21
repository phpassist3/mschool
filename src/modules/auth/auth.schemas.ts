import { z } from 'zod';

/**
 * Схемы валидации запросов модуля auth.
 *
 * Схемы лежат рядом с модулем, чтобы роуты, контроллеры и тесты
 * разделяли один источник истины о форме данных на проводе. Выведенные
 * из них типы протекают через слои — сервисы никогда не работают
 * с `any`.
 */

// 254 — практический максимум длины email (RFC 5321). Нижняя граница
// пароля 8 символов — компромисс между удобством и стоимостью
// brute-force; индикатор сложности на фронте остаётся правильным
// долгосрочным решением.
export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

// Логин принимает ровно ту же форму — мы никогда не сообщаем, какое
// именно поле неверно, только что учётные данные некорректны
// (см. auth.service.ts).
export const loginSchema = registerSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
