/**
 * Frontend Logger - sends browser logs to backend with batching
 *
 * Usage:
 *   frontendLogger.info('[PageName]', 'Step 1: Processing', { stepId: 1 });
 *   frontendLogger.error('[PageName]', 'Failed to load', { error: err });
 * 
 * Logs are buffered and sent in batches to reduce network requests.
 * Default flush interval: 1 second or when buffer reaches 20 entries.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  prefix: string;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  url: string;
  userAgent: string;
}

interface LogOptions {
  sendToBackend?: boolean; // Whether to send this log to backend (default: true for info/warn/error)
}

/** 默认刷新延迟（毫秒） */
const FLUSH_DELAY_MS = 1000;

/** 缓冲区最大条目数，超过自动刷新 */
const MAX_BUFFER_SIZE = 20;

class FrontendLogger {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private addToBuffer(
    level: LogLevel,
    prefix: string,
    message: string,
    context?: Record<string, any>
  ) {
    const entry: LogEntry = {
      level,
      prefix,
      message,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    this.buffer.push(entry);

    // 如果缓冲区已满，立即刷新
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flush();
      return;
    }

    // 否则，安排延迟刷新
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return; // 已有定时器

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  private flush() {
    // 清除定时器
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // 如果缓冲区为空，直接返回
    if (this.buffer.length === 0) return;

    // 取出所有日志并清空缓冲区
    const logs = [...this.buffer];
    this.buffer = [];

    // 异步发送，不阻塞主线程
    this.sendBatch(logs);
  }

  private async sendBatch(logs: LogEntry[]) {
    try {
      fetch('/api/logs/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      }).catch((err) => {
        // Silently fail - don't disrupt user experience
        console.warn('Failed to send logs to backend:', err);
      });
    } catch (err) {
      // Silently fail
    }
  }

  info(prefix: string, message: string, context?: Record<string, any>, options: LogOptions = {}) {
    console.log(`${prefix} ${message}`, context || '');

    if (options.sendToBackend !== false) {
      this.addToBuffer('info', prefix, message, context);
    }
  }

  warn(prefix: string, message: string, context?: Record<string, any>, options: LogOptions = {}) {
    console.warn(`${prefix} ${message}`, context || '');

    if (options.sendToBackend !== false) {
      this.addToBuffer('warn', prefix, message, context);
    }
  }

  error(prefix: string, message: string, context?: Record<string, any>, options: LogOptions = {}) {
    console.error(`${prefix} ${message}`, context || '');

    if (options.sendToBackend !== false) {
      this.addToBuffer('error', prefix, message, context);
    }
  }

  /**
   * 立即刷新缓冲区（用于页面卸载等场景）
   */
  forceFlush() {
    this.flush();
  }
}

export const frontendLogger = new FrontendLogger();
