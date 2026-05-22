/**
 * HTTP Request Step Runner
 * Calls external REST/GraphQL APIs with template-evaluated body and headers
 */
import axios from 'axios';
import { evaluateTemplate } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';
const logger = new ServiceLogger('flowboard-runner-http');
export const httpRunner = {
    async execute(stepId, config, context) {
        try {
            const method = config.method ?? 'GET';
            const url = evaluateTemplate(config.url, context);
            const headers = evaluateTemplate(config.headers ?? {}, context);
            const body = evaluateTemplate(config.body, context);
            const timeout = config.timeout ?? 30000;
            const axiosConfig = {
                method: method.toLowerCase(),
                url,
                headers,
                timeout,
            };
            if (body !== undefined && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
                axiosConfig.data = body;
            }
            logger.info(`HTTP ${method} ${url}`, { stepId });
            const response = await axios(axiosConfig);
            return {
                status: 'completed',
                output: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: response.data,
                },
            };
        }
        catch (error) {
            logger.error(`HTTP request failed: ${error.message}`, { stepId });
            return {
                status: 'failed',
                error: { message: error.message, details: error.response?.data },
            };
        }
    },
};
