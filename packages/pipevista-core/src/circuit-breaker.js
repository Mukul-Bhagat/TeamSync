/**
 * PipeVista Circuit Breaker
 * Per-destination fault tolerance for gateway and connectors
 */
export class CircuitBreaker {
    name;
    state = 'closed';
    failures = 0;
    successes = 0;
    lastFailureTime = null;
    failureThreshold;
    timeoutMs;
    halfOpenMaxCalls;
    constructor(config) {
        this.name = config.name;
        this.failureThreshold = config.failureThreshold ?? 5;
        this.timeoutMs = config.timeoutMs ?? 30000;
        this.halfOpenMaxCalls = config.halfOpenMaxCalls ?? 3;
    }
    async execute(fn) {
        if (this.state === 'open') {
            const elapsed = Date.now() - (this.lastFailureTime ?? 0);
            if (elapsed < this.timeoutMs) {
                throw new CircuitBreakerOpenError(`Circuit ${this.name} is OPEN. Retry after ${this.timeoutMs - elapsed}ms`);
            }
            this.state = 'half-open';
            this.successes = 0;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    getState() { return this.state; }
    getMetrics() { return { state: this.state, failures: this.failures, successes: this.successes }; }
    onSuccess() {
        if (this.state === 'half-open') {
            this.successes++;
            if (this.successes >= this.halfOpenMaxCalls) {
                this.state = 'closed';
                this.failures = 0;
            }
        }
        else {
            this.failures = Math.max(0, this.failures - 1);
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === 'half-open') {
            this.state = 'open';
        }
        else if (this.failures >= this.failureThreshold) {
            this.state = 'open';
            console.error(`[circuit-breaker] Circuit ${this.name} OPENED after ${this.failures} failures`);
        }
    }
}
export class CircuitBreakerOpenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CircuitBreakerOpenError';
    }
}
