/**
 * FlowBoard Step Runners Registry
 * Maps step types to their runner implementations
 */
import { httpRunner } from './http-runner.js';
import { eventRunner } from './event-runner.js';
import { aiRunner } from './ai-runner.js';
import { conditionRunner } from './condition-runner.js';
import { delayRunner } from './delay-runner.js';
import { approvalRunner } from './approval-runner.js';
import { loopRunner } from './loop-runner.js';
import { parallelRunner } from './parallel-runner.js';
import { transformRunner } from './transform-runner.js';
import { taskRunner } from './task-runner.js';
import { notifyRunner } from './notify-runner.js';
import { customCodeRunner } from './custom-code-runner.js';
const runners = new Map([
    ['http_request', httpRunner],
    ['event_emit', eventRunner],
    ['ai_completion', aiRunner],
    ['condition', conditionRunner],
    ['delay', delayRunner],
    ['approval', approvalRunner],
    ['loop', loopRunner],
    ['parallel', parallelRunner],
    ['transform', transformRunner],
    ['task_create', taskRunner],
    ['notification', notifyRunner],
    ['custom_code', customCodeRunner],
]);
export function getRunner(type) {
    return runners.get(type);
}
export function registerRunner(type, runner) {
    runners.set(type, runner);
}
