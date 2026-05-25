/**
 * @vistafam/logger - Structured logging with correlation IDs
 * Pino-based logger with request context propagation
 */
import { randomUUID } from 'crypto';
class Logger {
    env;
    serviceName;
    constructor(serviceName = 'unknown') {
        this.env = typeof process !== 'undefined' ? process.env.NODE_ENV || 'development' : 'development';
        this.serviceName = serviceName;
    }
    child(context) {
        const child = new Logger(context.service ?? this.serviceName);
        return child;
    }
    log(level, message, context) {
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            service: this.serviceName,
            traceId: context?.traceId,
            requestId: context?.requestId,
            tenantId: context?.tenantId,
            userId: context?.userId,
        };
        const metadata = {};
        if (context?.error) {
            if (typeof context.error === 'string') {
                metadata.error = { message: context.error };
            }
            else {
                metadata.error = {
                    name: context.error.name,
                    message: context.error.message,
                    stack: context.error.stack,
                };
            }
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
            const colors = {
                debug: '\x1b[36m',
                info: '\x1b[32m',
                warn: '\x1b[33m',
                error: '\x1b[31m',
                fatal: '\x1b[35m',
            };
            const reset = '\x1b[0m';
            const ctx = context ? JSON.stringify(context) : '';
            console.log(`${colors[level]}[${entry.timestamp}] [${this.serviceName}] [${level.toUpperCase()}]${reset} ${message} ${ctx}`);
        }
        else {
            // Production: structured JSON output for Loki
            console.log(JSON.stringify(entry));
        }
        return entry;
    }
    debug(message, context) {
        return this.log('debug', message, context);
    }
    info(message, context) {
        return this.log('info', message, context);
    }
    warn(message, context) {
        return this.log('warn', message, context);
    }
    error(message, context) {
        return this.log('error', message, context);
    }
    fatal(message, context) {
        return this.log('fatal', message, context);
    }
    async flush() {
        // Flush any buffered logs (placeholder for future transport)
    }
}
// Global request context
const asyncLocalStorage = new Map();
export function setRequestContext(context) {
    const id = randomUUID();
    asyncLocalStorage.set(id, context);
    return id;
}
export function getRequestContext(id) {
    return asyncLocalStorage.get(id);
}
export function clearRequestContext(id) {
    asyncLocalStorage.delete(id);
}
export { Logger };
export const createLogger = (serviceName) => new Logger(serviceName);
