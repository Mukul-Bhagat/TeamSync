/**
 * FlowBoard DAG Executor
 * Builds DAG from workflow steps, topological sort, parallel execution tracking
 */
export class DAGExecutor {
    nodes = new Map();
    build(steps) {
        this.nodes.clear();
        // Initialize nodes
        for (const step of steps) {
            this.nodes.set(step.id, {
                stepId: step.id,
                dependencies: step.dependsOn ?? [],
                dependents: [],
                status: 'pending',
            });
        }
        // Build reverse edges
        for (const step of steps) {
            for (const dep of step.dependsOn ?? []) {
                const depNode = this.nodes.get(dep);
                if (depNode) {
                    depNode.dependents.push(step.id);
                }
            }
        }
    }
    getReadySteps() {
        return Array.from(this.nodes.values()).filter((node) => node.status === 'pending' &&
            node.dependencies.every((dep) => this.nodes.get(dep)?.status === 'completed'));
    }
    markRunning(stepId) {
        const node = this.nodes.get(stepId);
        if (node && node.status === 'pending') {
            node.status = 'running';
        }
    }
    markComplete(stepId, output) {
        const node = this.nodes.get(stepId);
        if (!node)
            return;
        node.status = 'completed';
        node.output = output;
    }
    markFailed(stepId) {
        const node = this.nodes.get(stepId);
        if (!node)
            return;
        node.status = 'failed';
        // Mark all dependents as skipped
        for (const dependentId of node.dependents) {
            this.markSkipped(dependentId);
        }
    }
    markSkipped(stepId) {
        const node = this.nodes.get(stepId);
        if (!node || node.status !== 'pending')
            return;
        node.status = 'skipped';
        for (const dependentId of node.dependents) {
            this.markSkipped(dependentId);
        }
    }
    isComplete() {
        return Array.from(this.nodes.values()).every((node) => node.status === 'completed' || node.status === 'skipped');
    }
    hasFailed() {
        return Array.from(this.nodes.values()).some((node) => node.status === 'failed');
    }
    getNode(stepId) {
        return this.nodes.get(stepId);
    }
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    getCompletedNodes() {
        return Array.from(this.nodes.values()).filter((n) => n.status === 'completed');
    }
    getFailedNodes() {
        return Array.from(this.nodes.values()).filter((n) => n.status === 'failed');
    }
    getNodesInReverseOrder() {
        // Topological sort reversed (dependents first)
        const visited = new Set();
        const result = [];
        const visit = (stepId) => {
            if (visited.has(stepId))
                return;
            visited.add(stepId);
            const node = this.nodes.get(stepId);
            if (!node)
                return;
            // Visit dependents first
            for (const dep of node.dependents) {
                visit(dep);
            }
            result.push(node);
        };
        for (const stepId of this.nodes.keys()) {
            visit(stepId);
        }
        return result;
    }
}
