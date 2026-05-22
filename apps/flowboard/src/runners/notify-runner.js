/**
 * Notification Step Runner
 * Sends realtime notifications via PipeVista Realtime service
 */
import axios from 'axios';
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-notify');
const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:4105';
export const notifyRunner = {
    async execute(stepId, config, context) {
        try {
            const tenantId = context.tenantId ?? 'default';
            const eventName = config.eventName ?? 'notification';
            const userIds = evaluateTemplate(config.userIds, context);
            const channelId = evaluateTemplate(config.channelId, context);
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
        }
        catch (error) {
            logger.error(`Notification failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
