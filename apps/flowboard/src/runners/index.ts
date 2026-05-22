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
import { ExecutionContext } from '../engine/template-engine.js';

export interface StepResult {
  status: 'completed' | 'failed' | 'waiting_approval';
  output?: unknown;
  error?: { message: string; details?: unknown };
}

export interface StepRunner {
  execute(
    stepId: string,
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<StepResult>;
}

const runners = new Map<string, StepRunner>([
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

export function getRunner(type: string): StepRunner | undefined {
  return runners.get(type);
}

export function registerRunner(type: string, runner: StepRunner): void {
  runners.set(type, runner);
}
