/**
 * PipeVista Standard Health Check Utilities
 */
export async function runHealthChecks(serviceName, version, configs) {
    const start = Date.now();
    const checks = await Promise.all(configs.map(async (config) => {
        try {
            return await config.checkFn();
        }
        catch (error) {
            return { status: 'down', latencyMs: 0, message: error.message };
        }
    }));
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
export async function simpleHealthCheck(name) {
    const start = Date.now();
    try {
        // Override per dependency
        return { status: 'up', latencyMs: Date.now() - start };
    }
    catch {
        return { status: 'down', latencyMs: Date.now() - start };
    }
}
