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

/**
 * POST /api/logs/frontend
 *
 * Receives frontend logs and writes them to backend logger
 */
export async function POST(request: NextRequest) {
  try {
    const body: FrontendLogEntry = await request.json();

    const { level, prefix, message, context = {}, timestamp, url, userAgent } = body;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to process frontend log');
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
