import { prisma } from '../../db/prisma';

/**
 * Доступ к данным для агрегата Lesson. Урок существует только в
 * контексте курса — нет запроса «все уроки подряд», и `courseId`
 * всегда входит в фильтр.
 */
export const lessonsRepository = {
  create: (data: { title: string; content: string; courseId: string }) =>
    prisma.lesson.create({ data }),

  findById: (id: string) => prisma.lesson.findUnique({ where: { id } }),

  /**
   * Удаляем только если урок реально принадлежит указанному курсу —
   * защищаемся от попытки удалить «чужой» урок через URL-инъекцию.
   * Возвращаем число затронутых строк, чтобы сервис мог выдать 404.
   */
  deleteIfInCourse: async (id: string, courseId: string) => {
    const res = await prisma.lesson.deleteMany({ where: { id, courseId } });
    return res.count;
  },

  listByCourse: (courseId: string, page: number, limit: number) =>
    prisma.$transaction([
      prisma.lesson.findMany({
        where: { courseId },
        // Сортировка по возрастанию createdAt — разумная замена
        // порядка уроков, пока мы не ввели явное поле `position`.
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lesson.count({ where: { courseId } }),
    ]),
};
