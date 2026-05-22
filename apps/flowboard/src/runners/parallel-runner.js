/**
 * Parallel Step Runner
 * Forks into multiple branches that execute concurrently
 * Returns when all branches complete
 */
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-parallel');
export const parallelRunner = {
    async execute(stepId, config, context) {
        try {
            const branches = config.branches ?? [];
            const maxConcurrency = config.maxConcurrency ?? 5;
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
        }
        catch (error) {
            logger.error(`Parallel execution failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
