/**
 * FlowBoard DAG Executor
 * Builds DAG from workflow steps, topological sort, parallel execution tracking
 */

export interface DAGNode {
  stepId: string;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
}

export interface WorkflowStep {
  id: string;
  name?: string;
  type: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
  retryPolicy?: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitter: boolean;
  };
  timeoutMs?: number;
  onFailure?: 'cancel' | 'continue' | 'compensate' | 'notify';
  compensation?: { type: string; config: Record<string, unknown> };
}

export class DAGExecutor {
  private nodes = new Map<string, DAGNode>();

  build(steps: WorkflowStep[]): void {
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

  getReadySteps(): DAGNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) =>
        node.status === 'pending' &&
        node.dependencies.every((dep) => this.nodes.get(dep)?.status === 'completed')
    );
  }

  markRunning(stepId: string): void {
    const node = this.nodes.get(stepId);
    if (node && node.status === 'pending') {
      node.status = 'running';
    }
  }

  markComplete(stepId: string, output?: unknown): void {
    const node = this.nodes.get(stepId);
    if (!node) return;
    node.status = 'completed';
    node.output = output;
  }

  markFailed(stepId: string): void {
    const node = this.nodes.get(stepId);
    if (!node) return;
    node.status = 'failed';

    // Mark all dependents as skipped
    for (const dependentId of node.dependents) {
      this.markSkipped(dependentId);
    }
  }

  markSkipped(stepId: string): void {
    const node = this.nodes.get(stepId);
    if (!node || node.status !== 'pending') return;
    node.status = 'skipped';
    for (const dependentId of node.dependents) {
      this.markSkipped(dependentId);
    }
  }

  isComplete(): boolean {
    return Array.from(this.nodes.values()).every(
      (node) => node.status === 'completed' || node.status === 'skipped'
    );
  }

  hasFailed(): boolean {
    return Array.from(this.nodes.values()).some((node) => node.status === 'failed');
  }

  getNode(stepId: string): DAGNode | undefined {
    return this.nodes.get(stepId);
  }

  getAllNodes(): DAGNode[] {
    return Array.from(this.nodes.values());
  }

  getCompletedNodes(): DAGNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.status === 'completed');
  }

  getFailedNodes(): DAGNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.status === 'failed');
  }

  getNodesInReverseOrder(): DAGNode[] {
    // Topological sort reversed (dependents first)
    const visited = new Set<string>();
    const result: DAGNode[] = [];

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      const node = this.nodes.get(stepId);
      if (!node) return;
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
