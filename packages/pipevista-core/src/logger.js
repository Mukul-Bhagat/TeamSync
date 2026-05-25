/**
 * PipeVista Service Logger
 * Structured JSON logging with service context
 */
export class ServiceLogger {
    service;
    env;
    constructor(service) {
        this.service = service;
        this.env = process.env.NODE_ENV ?? 'development';
    }
    log(level, message, context) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            message,
            ...context,
        };
        if (this.env === 'development') {
            const colors = {
                debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m',
                error: '\x1b[31m', fatal: '\x1b[35m',
            };
            console.log(`${colors[level]}[${this.service}] [${level.toUpperCase()}]\x1b[0m ${message}`);
        }
        else {
            console.log(JSON.stringify(entry));
        }
    }
    debug(msg, ctx) { this.log('debug', msg, ctx); }
    info(msg, ctx) { this.log('info', msg, ctx); }
    warn(msg, ctx) { this.log('warn', msg, ctx); }
    error(msg, ctx) { this.log('error', msg, ctx); }
    fatal(msg, ctx) { this.log('fatal', msg, ctx); }
}
