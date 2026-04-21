import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { logger } from './utils/logger';

/**
 * Точка входа процесса.
 *
 * Отвечает за:
 *   - запуск HTTP-сервера;
 *   - обработку SIGINT / SIGTERM, чтобы `docker stop` проходил
 *     корректно (прекращаем принимать новые соединения, доживаем
 *     in-flight, закрываем пул БД). Без этого контейнеры ждут весь
 *     stop-timeout (10с) и ловят SIGKILL, что может побить открытые
 *     транзакции.
 */
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on :${env.PORT}`);
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Защитная сетка: если зависшее соединение блокирует `server.close`,
  // принудительно выходим через 10 секунд — оркестратор нас перезапустит.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
