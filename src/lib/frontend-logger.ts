/**
 * Frontend Logger - sends browser logs to backend
 *
 * Usage:
 *   frontendLogger.info('[PageName]', 'Step 1: Processing', { stepId: 1 });
 *   frontendLogger.error('[PageName]', 'Failed to load', { error: err });
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogOptions {
  sendToBackend?: boolean; // Whether to send this log to backend (default: true for info/warn/error)
}

class FrontendLogger {
  private async sendToBackend(
    level: LogLevel,
    prefix: string,
    message: string,
    context?: Record<string, any>
  ) {
    try {
      // Don't block the main thread
      fetch('/api/logs/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          prefix,
          message,
          context,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch((err) => {
        // Silently fail - don't disrupt user experience
        console.warn('Failed to send log to backend:', err);
      });
    } catch (err) {
      // Silently fail
    }
  }

  info(prefix: string, message: string, context?: Record<string, any>, options: LogOptions = {}) {
    console.log(`${prefix} ${message}`, context || '');

    if (options.sendToBackend !== false) {
      this.sendToBackend('info', prefix, message, context);
    }
  }

  warn(prefix: string, message: string, context?: Record<string, any>, options: LogOptions = {}) {
    console.warn(`${prefix} ${message}`, context || '');

    if (options.sendToBackend !== false) {
      this.sendToBackend('warn', prefix, message, context);
    }
  }

  error(prefix: string, message: string, context?: Record<string, any>, options: LogOptions = {}) {
    console.error(`${prefix} ${message}`, context || '');

    if (options.sendToBackend !== false) {
      this.sendToBackend('error', prefix, message, context);
    }
  }
}

export const frontendLogger = new FrontendLogger();
