import pino from 'pino';
import { env } from '../config/env';

/**
 * Структурированный JSON-логгер.
 *
 * JSON-строки дружат с любым log shipper'ом (Loki/ELK/Datadog) — без
 * хаков на парсинге позже. Уровень управляется через LOG_LEVEL,
 * так что поднять verbosity в staging можно без правок кода.
 */
export const logger = pino({ level: env.LOG_LEVEL });
