import { AppError } from '../../errors/AppError';
import { quizzesRepository } from './quizzes.repository';
import { UpsertQuizInput } from './quizzes.schemas';

/**
 * Бизнес-логика тестов.
 *
 * Инварианты:
 *   - Тест всегда привязан к существующему уроку.
 *   - Создавать/менять/удалять тест может только автор курса, к
 *     которому принадлежит урок.
 *   - Ответы на попытку проверяются на сервере — `correctIndex` никогда
 *     не уходит клиенту по публичным эндпоинтам.
 */
export const quizzesService = {
  async upsert(lessonId: string, userId: string, input: UpsertQuizInput) {
    await assertAuthorship(lessonId, userId);
    return quizzesRepository.replaceForLesson(lessonId, input.passingScore, input.questions);
  },

  async getPublic(lessonId: string) {
    const quiz = await quizzesRepository.findByLessonPublic(lessonId);
    if (!quiz) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
    return {
      lessonId,
      passingScore: quiz.passingScore,
      questions: quiz.questions,
    };
  },

  async delete(lessonId: string, userId: string) {
    await assertAuthorship(lessonId, userId);
    const count = await quizzesRepository.deleteByLesson(lessonId);
    if (count === 0) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
  },

  /**
   * Проверяем попытку. Возвращаем:
   *   - score (%) и `passed`;
   *   - массив `correct: boolean[]` по позициям вопросов, чтобы фронт
   *     мог подсветить правильные/неправильные;
   *   - реальные правильные индексы — их показываем только после
   *     попытки, чтобы студент увидел, что надо было выбрать.
   */
  async attempt(lessonId: string, answers: number[]) {
    const quiz = await quizzesRepository.findByLessonForScoring(lessonId);
    if (!quiz) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND');
    if (answers.length !== quiz.questions.length) {
      throw new AppError(400, 'Answers count does not match questions', 'VALIDATION_ERROR');
    }

    const correctFlags: boolean[] = quiz.questions.map(
      (q, i) => answers[i] === q.correctIndex,
    );
    const correctCount = correctFlags.filter(Boolean).length;
    const total = quiz.questions.length;
    const score = Math.round((correctCount / total) * 100);

    return {
      score,
      total,
      correctCount,
      correct: correctFlags,
      correctIndices: quiz.questions.map((q) => q.correctIndex),
      passed: score >= quiz.passingScore,
      passingScore: quiz.passingScore,
    };
  },
};

/**
 * Достаёт урок и связанный курс одним запросом и удостоверяется,
 * что пользователь — автор курса. Выделено отдельной функцией,
 * потому что нужно в трёх местах сервиса.
 */
async function assertAuthorship(lessonId: string, userId: string) {
  const lesson = await quizzesRepository.findLessonWithCourse(lessonId);
  if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
  if (lesson.course.authorId !== userId) {
    throw new AppError(403, 'Only the course author can manage the quiz', 'FORBIDDEN');
  }
}
