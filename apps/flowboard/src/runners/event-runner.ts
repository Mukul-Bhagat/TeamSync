/**
 * Event Emit Step Runner
 * Publishes events to PipeVista Event Hub
 */

import axios from 'axios';
import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-event');
const EVENT_HUB_URL = process.env.EVENT_HUB_URL ?? 'http://localhost:4101';

export const eventRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const subject = evaluateTemplate(config.subject as string, context) as string;
      const payload = evaluateTemplate(config.payload, context) as Record<string, unknown>;
      const tenantId = context.tenantId ?? 'default';
      const traceId = context.execution?.id ?? crypto.randomUUID();

      logger.info(`Emitting event: ${subject}`, { stepId, tenantId });

      await axios.post(`${EVENT_HUB_URL}/v1/events/publish`, {
        type: subject,
        tenantId,
        traceId,
        payload,
        subject,
      });

      return {
        status: 'completed',
        output: { subject, tenantId, traceId },
      };
    } catch (error: any) {
      logger.error(`Event emit failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message },
      };
    }
  },
};
