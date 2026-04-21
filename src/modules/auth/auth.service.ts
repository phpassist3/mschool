import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { authRepository } from './auth.repository';

/**
 * Бизнес-логика авторизации. Ничего не знает про Express — принимает
 * простые аргументы, возвращает простые данные и бросает `AppError`
 * в случае ошибки.
 */

// Подписываем короткий JWT только с полями, нужными downstream-коду.
// `sub` — стандартное поле "subject" (id пользователя). Сознательно
// не кладём туда ничего секретного (hash пароля, роли, которые можно
// менять серверно).
const issueToken = (user: { id: string; email: string }): string =>
  jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

// Публичная проекция записи пользователя — отрезает hash пароля и
// любые будущие внутренние поля перед тем, как ответ уйдёт наружу.
const toPublicUser = (user: { id: string; email: string }) => ({
  id: user.id,
  email: user.email,
});

export const authService = {
  /**
   * Регистрирует новый аккаунт. Пароль хешируется bcrypt'ом с cost=10
   * (разумный дефолт на современных CPU — ~60–80мс на hash). Возвращает
   * публичного пользователя и подписанный JWT, чтобы клиент мог не
   * делать отдельный login сразу после.
   */
  async register(email: string, password: string) {
    if (await authRepository.findByEmail(email)) {
      throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await authRepository.create({ email, password: passwordHash });
    return { user: toPublicUser(user), token: issueToken(user) };
  },

  /**
   * Проверяет учётные данные. Единый ответ 401 на «нет такого email»
   * и «неверный пароль» — намеренно: не даём атакующему перечислять
   * пользователей системы.
   */
  async login(email: string, password: string) {
    const user = await authRepository.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }
    return { user: toPublicUser(user), token: issueToken(user) };
  },
};
