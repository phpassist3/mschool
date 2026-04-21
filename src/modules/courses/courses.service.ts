import { AppError } from '../../errors/AppError';
import { coursesRepository } from './courses.repository';
import { CreateCourseInput } from './courses.schemas';

/**
 * Бизнес-логика курсов.
 *
 * Здесь никто не знает про HTTP-коды и Express — это задача
 * контроллера. Мы бросаем `AppError`, а централизованный обработчик
 * ошибок маппит его в ответ.
 */
export const coursesService = {
  // Rate-limit проверяется в middleware до входа сюда — поэтому метод
  // просто проставляет автора и сохраняет.
  create: (authorId: string, input: CreateCourseInput) =>
    coursesRepository.create({ ...input, authorId }),

  async getById(id: string) {
    const course = await coursesRepository.findById(id);
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    return course;
  },

  async list(page: number, limit: number) {
    const [items, total] = await coursesRepository.listPaginated(page, limit);
    // `pages` клампим хотя бы к 1, чтобы клиент никогда не видел
    // нулевого числа страниц для пустого списка (это путает пейджеры).
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
   * Удалить курс может только его автор. Каскадное удаление в схеме
   * БД снесёт все уроки, тесты и вопросы одной транзакцией.
   */
  async delete(userId: string, id: string) {
    const course = await coursesRepository.findById(id);
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    if (course.authorId !== userId) {
      throw new AppError(403, 'Only the course author can delete the course', 'FORBIDDEN');
    }
    await coursesRepository.delete(id);
  },
};
