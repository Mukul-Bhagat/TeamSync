/**
 * @vistafam/logger - Structured logging with correlation IDs
 * Pino-based logger with request context propagation
 */

import { randomUUID } from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  service?: string;
  traceId?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  traceId?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private env: string;
  private serviceName: string;

  constructor(serviceName: string = 'unknown') {
    this.env = typeof process !== 'undefined' ? process.env.NODE_ENV || 'development' : 'development';
    this.serviceName = serviceName;
  }

  child(context: LogContext): Logger {
    const child = new Logger(context.service ?? this.serviceName);
    return child;
  }

  private log(level: LogLevel, message: string, context?: LogContext & { error?: Error }) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      traceId: context?.traceId,
      requestId: context?.requestId,
      tenantId: context?.tenantId,
      userId: context?.userId,
    };

    const metadata: Record<string, unknown> = {};
    if (context?.error) {
      metadata.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack,
      };
    }
    // Copy remaining context fields
    for (const [key, value] of Object.entries(context ?? {})) {
      if (!['traceId', 'requestId', 'tenantId', 'userId', 'service', 'error'].includes(key)) {
        metadata[key] = value;
      }
    }
    if (Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    if (this.env === 'development') {
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        fatal: '\x1b[35m',
      };
      const reset = '\x1b[0m';
      const ctx = context ? JSON.stringify(context) : '';
      console.log(`${colors[level]}[${entry.timestamp}] [${this.serviceName}] [${level.toUpperCase()}]${reset} ${message} ${ctx}`);
    } else {
      // Production: structured JSON output for Loki
      console.log(JSON.stringify(entry));
    }

    return entry;
  }

  debug(message: string, context?: LogContext) {
    return this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    return this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    return this.log('warn', message, context);
  }

  error(message: string, context?: LogContext & { error?: Error }) {
    return this.log('error', message, context);
  }

  fatal(message: string, context?: LogContext & { error?: Error }) {
    return this.log('fatal', message, context);
  }

  async flush(): Promise<void> {
    // Flush any buffered logs (placeholder for future transport)
  }
}

// Global request context
const asyncLocalStorage = new Map<string, LogContext>();

export function setRequestContext(context: LogContext): string {
  const id = randomUUID();
  asyncLocalStorage.set(id, context);
  return id;
}

export function getRequestContext(id: string): LogContext | undefined {
  return asyncLocalStorage.get(id);
}

export function clearRequestContext(id: string): void {
  asyncLocalStorage.delete(id);
}

export { Logger };
export const createLogger = (serviceName: string) => new Logger(serviceName);
