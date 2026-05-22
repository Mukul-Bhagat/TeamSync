/**
 * AI Completion Step Runner
 * Delegates to PipeVista AI Router for multi-provider LLM calls
 */

import axios from 'axios';
import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-ai');
const AI_ROUTER_URL = process.env.AI_ROUTER_URL ?? 'http://localhost:4102';

export const aiRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const model = (config.model as string) ?? 'gpt-4o';
      const systemPrompt = evaluateTemplate(config.systemPrompt as string, context) as string;
      const messages = evaluateTemplate(config.messages as unknown[], context) as Array<{ role: string; content: string }>;
      const responseFormat = (config.responseFormat as string) ?? 'text';
      const temperature = (config.temperature as number) ?? 0.2;
      const tenantId = context.tenantId ?? 'default';
      const traceId = context.execution?.id ?? crypto.randomUUID();

      logger.info(`AI completion: ${model}`, { stepId, tenantId });

      const response = await axios.post(`${AI_ROUTER_URL}/v1/ai/chat`, {
        model,
        systemPrompt,
        messages,
        responseFormat,
        temperature,
        tenantId,
        traceId,
      });

      return {
        status: 'completed',
        output: response.data,
      };
    } catch (error: any) {
      logger.error(`AI completion failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message, details: error.response?.data },
      };
    }
  },
};
