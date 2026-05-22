/**
 * Transform Step Runner
 * JSONata data transformation and reshaping
 */
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-transform');
export const transformRunner = {
    async execute(stepId, config, context) {
        try {
            const mapping = config.mapping;
            if (!mapping) {
                return { status: 'failed', error: { message: 'Missing mapping in transform step' } };
            }
            const result = evaluateTemplate(mapping, context);
            logger.info(`Transform completed`, { stepId });
            return {
                status: 'completed',
                output: result,
            };
        }
        catch (error) {
            logger.error(`Transform failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
