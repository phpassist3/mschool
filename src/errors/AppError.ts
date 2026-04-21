/**
 * Доменная ошибка с HTTP-статусом и машинно-читаемым кодом.
 *
 * Сервисы бросают именно их; контроллеры не видят «голых» ошибок
 * из Prisma/Zod/внутренних источников — централизованный
 * errorHandler превращает всё остальное в общий 500 без утечек
 * деталей наружу.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}
