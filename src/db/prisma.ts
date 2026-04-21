import { PrismaClient } from '@prisma/client';

/**
 * Один PrismaClient на процесс.
 *
 * Каждый клиент владеет собственным пулом соединений; создание
 * нескольких экземпляров молча исчерпает `max_connections` у БД —
 * частая причина ошибок «too many clients» в долго живущих
 * Node.js-сервисах.
 */
export const prisma = new PrismaClient();
