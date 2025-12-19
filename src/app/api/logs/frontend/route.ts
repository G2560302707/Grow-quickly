import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('frontend-logs');

export const runtime = 'nodejs';

interface FrontendLogEntry {
  level: 'info' | 'warn' | 'error';
  prefix: string;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

interface BatchLogRequest {
  logs: FrontendLogEntry[];
}

/**
 * POST /api/logs/frontend
 *
 * Receives frontend logs and writes them to backend logger
 * Supports both single log and batch log formats.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 支持批量日志格式 { logs: [...] } 和单条日志格式
    const logs: FrontendLogEntry[] = Array.isArray(body.logs) ? body.logs : [body];

    for (const entry of logs) {
      const { level, prefix, message, context = {}, timestamp, url, userAgent } = entry;

      // Build log context
      const logContext = {
        source: 'frontend',
        prefix,
        url: url || request.headers.get('referer'),
        userAgent: userAgent || request.headers.get('user-agent'),
        clientTime: timestamp,
        ...context,
      };

      // Log to backend using appropriate level
      switch (level) {
        case 'error':
          logger.error(logContext, message);
          break;
        case 'warn':
          logger.warn(logContext, message);
          break;
        case 'info':
        default:
          logger.info(logContext, message);
          break;
      }
    }

    return NextResponse.json({ success: true, count: logs.length });
  } catch (error) {
    logger.error({ error }, 'Failed to process frontend log');
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
