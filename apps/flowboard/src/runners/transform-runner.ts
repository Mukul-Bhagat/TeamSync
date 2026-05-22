/**
 * Transform Step Runner
 * JSONata data transformation and reshaping
 */

import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-transform');

export const transformRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const mapping = config.mapping as Record<string, unknown>;
      if (!mapping) {
        return { status: 'failed', error: { message: 'Missing mapping in transform step' } };
      }

      const result = evaluateTemplate(mapping, context);
      logger.info(`Transform completed`, { stepId });

      return {
        status: 'completed',
        output: result,
      };
    } catch (error: any) {
      logger.error(`Transform failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message },
      };
    }
  },
};
