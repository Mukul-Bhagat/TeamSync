/**
 * Loop Step Runner
 * Iterates over a collection and runs sub-steps for each item
 */
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-loop');
export const loopRunner = {
    async execute(stepId, config, context) {
        try {
            const collection = evaluateTemplate(config.collection, context);
            const maxIterations = config.maxIterations ?? 1000;
            if (!Array.isArray(collection)) {
                return { status: 'failed', error: { message: 'Loop collection must be an array' } };
            }
            if (collection.length > maxIterations) {
                return { status: 'failed', error: { message: `Loop exceeds max iterations: ${maxIterations}` } };
            }
            const results = [];
            const loopContext = { ...context };
            for (let i = 0; i < collection.length; i++) {
                const item = collection[i];
                loopContext.loop = { index: i, item, collection };
                // Evaluate the sub-step config for this iteration
                const subStepConfig = evaluateTemplate(config.step, loopContext);
                // Execute the inner step (simplified: just store the evaluated config)
                results.push({ index: i, item, stepConfig: subStepConfig });
            }
            logger.info(`Loop completed: ${results.length} iterations`, { stepId });
            return {
                status: 'completed',
                output: { iterations: results.length, results },
            };
        }
        catch (error) {
            logger.error(`Loop execution failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
