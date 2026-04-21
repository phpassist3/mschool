import { prisma } from '../../db/prisma';
import { QuestionInput } from './quizzes.schemas';

/**
 * Доступ к данным для тестов.
 *
 * В запросах, нужных для авторизации, мы подтягиваем урок вместе с
 * его курсом — чтобы проверить `authorId` одним обращением к БД.
 */
export const quizzesRepository = {
  // Урок + курс — минимум для проверки «автор или нет».
  findLessonWithCourse: (lessonId: string) =>
    prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { id: true, authorId: true } } },
    }),

  // Полный тест с приватным `correctIndex` — для проверки попыток.
  findByLessonForScoring: (lessonId: string) =>
    prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          select: { id: true, correctIndex: true, position: true },
        },
      },
    }),

  // Публичный тест — без `correctIndex`, чтобы не подсказывать клиенту.
  findByLessonPublic: (lessonId: string) =>
    prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          select: { id: true, text: true, options: true, position: true },
        },
      },
    }),

  /**
   * Upsert «целиком»: заменяем тест атомарно в транзакции. Проще и
   * предсказуемее, чем диффить вопросы поштучно — редактирование
   * теста в UI всё равно идёт одним сабмитом.
   */
  replaceForLesson: (lessonId: string, passingScore: number, questions: QuestionInput[]) =>
    prisma.$transaction(async (tx) => {
      await tx.quiz.deleteMany({ where: { lessonId } });
      return tx.quiz.create({
        data: {
          lessonId,
          passingScore,
          questions: {
            create: questions.map((q, i) => ({
              text: q.text,
              options: q.options,
              correctIndex: q.correctIndex,
              position: i,
            })),
          },
        },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            select: { id: true, text: true, options: true, position: true },
          },
        },
      });
    }),

  deleteByLesson: async (lessonId: string) => {
    const res = await prisma.quiz.deleteMany({ where: { lessonId } });
    return res.count;
  },
};
