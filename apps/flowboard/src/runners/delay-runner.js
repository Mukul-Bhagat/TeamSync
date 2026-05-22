/**
 * Delay Step Runner
 * Simply returns completed after the specified delay
 * The actual delay is handled by BullMQ delayed jobs
 */
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-delay');
export const delayRunner = {
    async execute(stepId, config, context) {
        const delayMs = config.delayMs ?? 1000;
        logger.info(`Delay step: ${delayMs}ms`, { stepId });
        // The actual delay is enforced by the BullMQ job delay or worker sleep
        await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5000))); // Cap at 5s in runner
        return {
            status: 'completed',
            output: { delayMs, resumedAt: new Date().toISOString() },
        };
    },
};
