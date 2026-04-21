import { AppError } from '../../errors/AppError';
import { coursesRepository } from '../courses/courses.repository';
import { lessonsRepository } from './lessons.repository';
import { CreateLessonInput } from './lessons.schemas';

/**
 * Бизнес-логика уроков.
 *
 * Здесь явно и в одном месте поддерживаются два инварианта:
 *   (1) родительский курс должен существовать;
 *   (2) мутировать уроки (добавлять/удалять) может только его автор.
 * Оба проверки формируют доменные ошибки (404 / 403), которые
 * HTTP-слой переводит в ответы.
 */
export const lessonsService = {
  async create(courseId: string, userId: string, input: CreateLessonInput) {
    const course = await coursesRepository.findById(courseId);
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    if (course.authorId !== userId) {
      throw new AppError(403, 'Only the course author can add lessons', 'FORBIDDEN');
    }
    return lessonsRepository.create({ ...input, courseId });
  },

  async listByCourse(courseId: string, page: number, limit: number) {
    // Отдавать 404 на отсутствующий курс дружелюбнее, чем молча
    // вернуть пустой список — клиент узнает про опечатку.
    const course = await coursesRepository.findById(courseId);
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    const [items, total] = await lessonsRepository.listByCourse(courseId, page, limit);
    return {
      items,
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  /**
   * Удаление урока: проверяем автора курса и удаляем атомарно через
   * `deleteMany` с фильтром по courseId — защита от попытки снести
   * урок из «чужого» курса, подменив :courseId в URL.
   */
  async delete(courseId: string, lessonId: string, userId: string) {
    const course = await coursesRepository.findById(courseId);
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    if (course.authorId !== userId) {
      throw new AppError(403, 'Only the course author can delete lessons', 'FORBIDDEN');
    }
    const count = await lessonsRepository.deleteIfInCourse(lessonId, courseId);
    if (count === 0) {
      throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    }
  },
};
