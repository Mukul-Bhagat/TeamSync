/**
 * HTTP Request Step Runner
 * Calls external REST/GraphQL APIs with template-evaluated body and headers
 */

import axios, { AxiosRequestConfig } from 'axios';
import { StepRunner, StepResult } from './index.js';
import { evaluateTemplate, ExecutionContext } from '../engine/template-engine.js';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('flowboard-runner-http');

export const httpRunner: StepRunner = {
  async execute(stepId: string, config: Record<string, unknown>, context: ExecutionContext): Promise<StepResult> {
    try {
      const method = (config.method as string) ?? 'GET';
      const url = evaluateTemplate(config.url as string, context) as string;
      const headers = evaluateTemplate((config.headers as Record<string, unknown>) ?? {}, context) as Record<string, string>;
      const body = evaluateTemplate(config.body, context);
      const timeout = (config.timeout as number) ?? 30000;

      const axiosConfig: AxiosRequestConfig = {
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
    } catch (error: any) {
      logger.error(`HTTP request failed: ${error.message}`, { stepId });
      return {
        status: 'failed',
        error: { message: error.message, details: error.response?.data },
      };
    }
  },
};
