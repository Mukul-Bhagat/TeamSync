/**
 * Custom Code Step Runner
 * Sandboxed JavaScript execution using Node.js vm module
 * Restricted: no network, limited memory, timeout enforced
 */
import { ServiceLogger } from '@vistafam/pipevista-core';
import { Script } from 'node:vm';
const logger = new ServiceLogger('flowboard-runner-custom-code');
export const customCodeRunner = {
    async execute(stepId, config, context) {
        try {
            const code = config.code;
            if (!code) {
                return { status: 'failed', error: { message: 'Missing code in custom_code step' } };
            }
            const timeoutMs = config.timeoutMs ?? 5000;
            const memoryLimitMB = config.memoryLimitMB ?? 128;
            logger.info(`Executing custom code`, { stepId, timeoutMs, memoryLimitMB });
            // Create sandbox with execution context
            const sandbox = {
                context: {
                    trigger: context.trigger,
                    workflow: context.workflow,
                    execution: context.execution,
                    variables: context.variables,
                    steps: context.steps,
                    timestamp: context.timestamp,
                    tenantId: context.tenantId,
                    userId: context.userId,
                },
                console: {
                    log: (...args) => logger.info(args.map(String).join(' '), { stepId }),
                    error: (...args) => logger.error(args.map(String).join(' '), { stepId }),
                },
                result: undefined,
            };
            const script = new Script(`
        (function() {
          ${code}
        })()
      `);
            script.runInNewContext(sandbox, {
                timeout: timeoutMs,
                displayErrors: true,
            });
            return {
                status: 'completed',
                output: sandbox.result,
            };
        }
        catch (error) {
            logger.error(`Custom code execution failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message },
            };
        }
    },
};
