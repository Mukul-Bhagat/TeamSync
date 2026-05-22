/**
 * PipeVista Service Logger
 * Structured JSON logging with service context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  service: string;
  traceId?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: unknown;
}

export class ServiceLogger {
  private service: string;
  private env: string;

  constructor(service: string) {
    this.service = service;
    this.env = process.env.NODE_ENV ?? 'development';
  }

  private log(level: LogLevel, message: string, context?: Partial<LogContext>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...context,
    };

    if (this.env === 'development') {
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m',
        error: '\x1b[31m', fatal: '\x1b[35m',
      };
      console.log(`${colors[level]}[${this.service}] [${level.toUpperCase()}]\x1b[0m ${message}`);
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(msg: string, ctx?: Partial<LogContext>) { this.log('debug', msg, ctx); }
  info(msg: string, ctx?: Partial<LogContext>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Partial<LogContext>) { this.log('warn', msg, ctx); }
  error(msg: string, ctx?: Partial<LogContext>) { this.log('error', msg, ctx); }
  fatal(msg: string, ctx?: Partial<LogContext>) { this.log('fatal', msg, ctx); }
}
