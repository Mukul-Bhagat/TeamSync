/**
 * FlowBoard Trigger Router
 * Matches incoming events/cron/webhooks against active workflow triggers
 */
import { createRedisClient, buildKey, ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-trigger-router');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redis = createRedisClient({ url: REDIS_URL });
/**
 * Register an active trigger pattern in Redis cache.
 * Called when workflow is published/activated.
 */
export async function registerTrigger(trigger) {
    const key = buildKey('fb', 'trigger', trigger.tenantId, trigger.triggerId);
    await redis.setex(key, 300, JSON.stringify(trigger));
    logger.info(`Trigger registered: ${trigger.triggerId} for workflow ${trigger.workflowId}`);
}
/**
 * Unregister a trigger (e.g., workflow paused/archived).
 */
export async function unregisterTrigger(tenantId, triggerId) {
    const key = buildKey('fb', 'trigger', tenantId, triggerId);
    await redis.del(key);
    logger.info(`Trigger unregistered: ${triggerId}`);
}
/**
 * Find matching workflows for an incoming event subject.
 */
export async function matchEventTriggers(tenantId, subject, payload) {
    const pattern = buildKey('fb', 'trigger', tenantId, '*');
    const keys = await redis.keys(pattern);
    const matches = [];
    for (const key of keys) {
        const data = await redis.get(key);
        if (!data)
            continue;
        try {
            const trigger = JSON.parse(data);
            if (trigger.type !== 'event')
                continue;
            const eventSubject = trigger.config.eventSubject;
            if (!eventSubject)
                continue;
            // Match: exact or wildcard pattern
            const regex = new RegExp('^' + eventSubject.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');
            if (regex.test(subject)) {
                // Apply optional JSON filter
                const filterExpr = trigger.config.filter;
                if (filterExpr) {
                    try {
                        const jsonata = (await import('jsonata')).default;
                        const expr = jsonata(filterExpr);
                        const result = await expr.evaluate(payload);
                        if (!result)
                            continue;
                    }
                    catch {
                        continue;
                    }
                }
                matches.push(trigger);
            }
        }
        catch {
            continue;
        }
    }
    return matches;
}
/**
 * Get all active cron triggers (for scheduler worker).
 */
export async function getCronTriggers() {
    const pattern = buildKey('fb', 'trigger', '*', '*');
    const keys = await redis.keys(pattern);
    const triggers = [];
    for (const key of keys) {
        const data = await redis.get(key);
        if (!data)
            continue;
        try {
            const trigger = JSON.parse(data);
            if (trigger.type === 'cron') {
                triggers.push(trigger);
            }
        }
        catch {
            continue;
        }
    }
    return triggers;
}
/**
 * Build trigger cache from database (called at startup or on workflow change).
 */
export async function rebuildTriggerCache(triggers) {
    // Clear existing triggers first
    const pattern = buildKey('fb', 'trigger', '*', '*');
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
    for (const trigger of triggers) {
        await registerTrigger(trigger);
    }
    logger.info(`Trigger cache rebuilt with ${triggers.length} triggers`);
}
