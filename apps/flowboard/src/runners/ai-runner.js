/**
 * AI Completion Step Runner
 * Delegates to PipeVista AI Router for multi-provider LLM calls
 */
import axios from 'axios';
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-ai');
const AI_ROUTER_URL = process.env.AI_ROUTER_URL ?? 'http://localhost:4102';
export const aiRunner = {
    async execute(stepId, config, context) {
        try {
            const model = config.model ?? 'gpt-4o';
            const systemPrompt = evaluateTemplate(config.systemPrompt, context);
            const messages = evaluateTemplate(config.messages, context);
            const responseFormat = config.responseFormat ?? 'text';
            const temperature = config.temperature ?? 0.2;
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
        }
        catch (error) {
            logger.error(`AI completion failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message, details: error.response?.data },
            };
        }
    },
};
