import { prisma } from '../../db/prisma';

/**
 * Тонкий слой доступа к данным для агрегата User.
 *
 * Сервис никогда не зовёт Prisma напрямую — только через этот объект.
 * Таким образом все настройки запросов (добавить `select`, сменить
 * индексы, заменить ORM) меняются в одном месте, не трогая
 * бизнес-логику и тесты.
 */
export const authRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  create: (data: { email: string; password: string }) => prisma.user.create({ data }),
};
