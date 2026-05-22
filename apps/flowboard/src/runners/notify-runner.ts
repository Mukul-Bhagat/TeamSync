/**
 * Notification Step Runner
 * Sends realtime notifications via PipeVista Realtime service
 */

import axios from 'axios';
import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-notify');
const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:4105';

export const notifyRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const tenantId = context.tenantId ?? 'default';
      const eventName = (config.eventName as string) ?? 'notification';
      const userIds = evaluateTemplate(config.userIds, context) as string[] | undefined;
      const channelId = evaluateTemplate(config.channelId as string, context) as string | undefined;
      const payload = evaluateTemplate(config.payload, context);

      logger.info(`Sending notification: ${eventName}`, { stepId, tenantId });

      await axios.post(`${REALTIME_URL}/v1/realtime/notify`, {
        tenantId,
        userIds,
        channelId,
        eventName,
        payload,
      });

      return {
        status: 'completed',
        output: { eventName, recipients: userIds?.length ?? 'broadcast' },
      };
    } catch (error: any) {
      logger.error(`Notification failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message },
      };
    }
  },
};
