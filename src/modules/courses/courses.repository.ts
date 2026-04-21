import { prisma } from '../../db/prisma';

/**
 * Доступ к данным для агрегата Course.
 *
 * `listPaginated` выполняет `findMany` и `count` в одной транзакции
 * Prisma — так страница и общий счёт остаются согласованными даже
 * при параллельных вставках между двумя запросами.
 */
export const coursesRepository = {
  create: (data: { title: string; description: string; authorId: string }) =>
    prisma.course.create({ data }),

  findById: (id: string) => prisma.course.findUnique({ where: { id } }),

  listPaginated: (page: number, limit: number) =>
    prisma.$transaction([
      prisma.course.findMany({
        // Сначала свежее — естественный дефолт для каталога курсов.
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.course.count(),
    ]),
};
