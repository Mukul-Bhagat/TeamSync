/**
 * FlowBoard Template Engine
 * JSONata-based expression evaluation with execution context
 */
import jsonata from 'jsonata';
const compiledExpressions = new Map();
function getCompiledExpression(expression) {
    if (!compiledExpressions.has(expression)) {
        compiledExpressions.set(expression, jsonata(expression));
    }
    return compiledExpressions.get(expression);
}
export function evaluateTemplate(template, context) {
    if (typeof template === 'string') {
        // Check if entire string is a template expression
        const match = template.match(/^\{\{\s*(.+?)\s*\}\}$/);
        if (match) {
            try {
                const expr = getCompiledExpression(match[1]);
                return expr.evaluate(context);
            }
            catch (err) {
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
            }
            catch {
                return '';
            }
        });
    }
    if (Array.isArray(template)) {
        return template.map((item) => evaluateTemplate(item, context));
    }
    if (template && typeof template === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(template)) {
            result[key] = evaluateTemplate(value, context);
        }
        return result;
    }
    return template;
}
export function evaluateCondition(expression, context) {
    try {
        const expr = getCompiledExpression(expression);
        const result = expr.evaluate(context);
        return Boolean(result);
    }
    catch {
        return false;
    }
}
export function clearTemplateCache() {
    compiledExpressions.clear();
}
