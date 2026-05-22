/**
 * Delay Step Runner
 * Simply returns completed after the specified delay
 * The actual delay is handled by BullMQ delayed jobs
 */

import { StepRunner, StepResult } from './index.js';
import { ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-delay');

export const delayRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    const delayMs = (config.delayMs as number) ?? 1000;
    logger.info(`Delay step: ${delayMs}ms`, { stepId });

    // The actual delay is enforced by the BullMQ job delay or worker sleep
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5000))); // Cap at 5s in runner

    return {
      status: 'completed',
      output: { delayMs, resumedAt: new Date().toISOString() },
    };
  },
};
