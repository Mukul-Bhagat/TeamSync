/**
 * PipeVista Standard Health Check Utilities
 */

import { HealthCheckResult } from './types';

export interface DependencyCheckConfig {
  name: string;
  checkFn: () => Promise<{ status: 'up' | 'down' | 'degraded'; latencyMs: number; message?: string }>;
}

export async function runHealthChecks(
  serviceName: string,
  version: string,
  configs: DependencyCheckConfig[]
): Promise<HealthCheckResult> {
  const start = Date.now();

  const checks = await Promise.all(
    configs.map(async (config) => {
      try {
        return await config.checkFn();
      } catch (error: any) {
        return { status: 'down' as const, latencyMs: 0, message: error.message };
      }
    })
  );

  const hasDown = checks.some((c) => c.status === 'down');
  const hasDegraded = checks.some((c) => c.status === 'degraded');
  const status = hasDown ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status,
    version,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: serviceName,
    checks: checks.map((c, i) => ({ name: configs[i].name, ...c })),
  };
}

export async function simpleHealthCheck(name: string): Promise<{ status: 'up' | 'down'; latencyMs: number }> {
  const start = Date.now();
  try {
    // Override per dependency
    return { status: 'up', latencyMs: Date.now() - start };
  } catch {
    return { status: 'down', latencyMs: Date.now() - start };
  }
}
