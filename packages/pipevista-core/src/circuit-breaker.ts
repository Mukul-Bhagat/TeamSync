/**
 * PipeVista Circuit Breaker
 * Per-destination fault tolerance for gateway and connectors
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold?: number;
  timeoutMs?: number;
  halfOpenMaxCalls?: number;
}

export class CircuitBreaker {
  private name: string;
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private failureThreshold: number;
  private timeoutMs: number;
  private halfOpenMaxCalls: number;

  constructor(config: CircuitBreakerConfig) {
    this.name = config.name;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.halfOpenMaxCalls = config.halfOpenMaxCalls ?? 3;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed < this.timeoutMs) {
        throw new CircuitBreakerOpenError(
          `Circuit ${this.name} is OPEN. Retry after ${this.timeoutMs - elapsed}ms`
        );
      }
      this.state = 'half-open';
      this.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitState { return this.state; }
  getMetrics() { return { state: this.state, failures: this.failures, successes: this.successes }; }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.halfOpenMaxCalls) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.error(`[circuit-breaker] Circuit ${this.name} OPENED after ${this.failures} failures`);
    }
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
