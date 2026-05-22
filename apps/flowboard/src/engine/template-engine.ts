/**
 * FlowBoard Template Engine
 * JSONata-based expression evaluation with execution context
 */

import jsonata from 'jsonata';

export interface ExecutionContext {
  trigger?: {
    type: string;
    payload: Record<string, unknown>;
  };
  workflow?: {
    id: string;
    name: string;
    tenantId: string;
  };
  execution?: {
    id: string;
    startedAt: string;
  };
  variables?: Record<string, unknown>;
  steps?: Record<string, { output?: unknown; status: string }>;
  timestamp?: string;
  tenantId?: string;
  userId?: string;
}

const compiledExpressions = new Map<string, jsonata.Expression>();

function getCompiledExpression(expression: string): jsonata.Expression {
  if (!compiledExpressions.has(expression)) {
    compiledExpressions.set(expression, jsonata(expression));
  }
  return compiledExpressions.get(expression)!;
}

export function evaluateTemplate(template: unknown, context: ExecutionContext): unknown {
  if (typeof template === 'string') {
    // Check if entire string is a template expression
    const match = template.match(/^\{\{\s*(.+?)\s*\}\}$/);
    if (match) {
      try {
        const expr = getCompiledExpression(match[1]);
        return expr.evaluate(context);
      } catch (err) {
        // If JSONata fails, return the raw string
        return template;
      }
    }

    // Interpolate expressions within text
    return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_full, exprStr) => {
      try {
        const expr = getCompiledExpression(exprStr);
        const result = expr.evaluate(context);
        return result === undefined ? '' : String(result);
      } catch {
        return '';
      }
    });
  }

  if (Array.isArray(template)) {
    return template.map((item) => evaluateTemplate(item, context));
  }

  if (template && typeof template === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = evaluateTemplate(value, context);
    }
    return result;
  }

  return template;
}

export function evaluateCondition(expression: string, context: ExecutionContext): boolean {
  try {
    const expr = getCompiledExpression(expression);
    const result = expr.evaluate(context);
    return Boolean(result);
  } catch {
    return false;
  }
}

export function clearTemplateCache(): void {
  compiledExpressions.clear();
}
