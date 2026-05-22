/**
 * Condition Step Runner
 * Evaluates JSONata expression and returns true/false
 */
import { evaluateCondition } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-condition');
export const conditionRunner = {
    async execute(stepId, config, context) {
        try {
            const expression = config.expression;
            if (!expression) {
                return { status: 'failed', error: { message: 'Missing expression in condition step' } };
            }
            const result = evaluateCondition(expression, context);
            logger.info(`Condition evaluated: ${result}`, { stepId, expression });
            return {
                status: 'completed',
                output: { result, expression },
            };
        }
        catch (error) {
            logger.error(`Condition evaluation failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
