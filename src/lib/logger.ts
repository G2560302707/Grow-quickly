import pino from 'pino';

/**
 * Application logger based on pino
 *
 * Features:
 * - High performance (5-10x faster than other loggers)
 * - Small bundle size (~50KB)
 * - JSON output in production, pretty output in development
 * - Configurable log levels via LOG_LEVEL env var
 *
 * Usage:
 *   logger.info({ userId: 123 }, 'User logged in');
 *   logger.error({ error }, 'Failed to process request');
 *   logger.debug({ data }, 'Debug information');
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Development: pretty console output
  // Production: JSON format for log aggregation
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  } : undefined,

  // Base context for all logs
  base: {
    env: process.env.NODE_ENV,
  },
});

/**
 * Create a child logger with additional context
 *
 * Usage:
 *   const apiLogger = createLogger('api');
 *   apiLogger.info({ route: '/analyze' }, 'API called');
 */
export function createLogger(module: string) {
  return logger.child({ module });
}
