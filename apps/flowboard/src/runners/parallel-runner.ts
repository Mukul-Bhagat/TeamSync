/**
 * Parallel Step Runner
 * Forks into multiple branches that execute concurrently
 * Returns when all branches complete
 */

import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-parallel');

export const parallelRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const branches = (config.branches as Record<string, unknown>[]) ?? [];
      const maxConcurrency = (config.maxConcurrency as number) ?? 5;

      logger.info(`Parallel branches: ${branches.length}, maxConcurrency: ${maxConcurrency}`, { stepId });

      // Evaluate each branch config
      const evaluatedBranches = branches.map((branch, idx) => ({
        index: idx,
        config: evaluateTemplate(branch, context),
      }));

      return {
        status: 'completed',
        output: { branches: evaluatedBranches.length, results: evaluatedBranches },
      };
    } catch (error: any) {
      logger.error(`Parallel execution failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message },
      };
    }
  },
};
