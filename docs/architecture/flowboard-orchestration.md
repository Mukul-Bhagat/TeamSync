# FlowBoard Orchestration Model

## 14. FlowBoard Orchestration Model

### What Makes FlowBoard Different from Generic Workflow Tools?

FlowBoard is not just a visual workflow builder—it is the **central nervous system** of the VistaFam ecosystem. It is designed specifically for:
- **Event-native triggers**: Every service event can start a workflow
- **Multi-tenant DAG execution**: Each tenant has isolated workflow definitions and executions
- **AI-augmented steps**: Native integration with InsightAI for intelligent automation
- **Human-in-the-loop**: Approval steps that pause execution and wait for user interaction
- **Compensation**: Automatic rollback when workflows fail

### Orchestration Engine Core

```
┌─────────────────────────────────────────────────────────────────┐
│                  FLOWBOARD ORCHESTRATION ENGINE                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Workflow Registry (per tenant)                            ││
│  │  • CRUD workflow definitions                                ││
│  │  • Version control (draft → published → deprecated)        ││
│  │  • Template library (pre-built workflows)                   ││
│  │  • Import/export (JSON/YAML)                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Trigger Engine                                             ││
│  │  • Event Subscribers (one per active workflow)              ││
│  │  • Schedule Manager (BullMQ repeatable jobs)                ││
│  │  • Webhook Endpoints (per-tenant unique URLs)               ││
│  │  • Manual Triggers (API or UI button)                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Execution Engine                                           ││
│  │  • DAG Builder (topological sort)                           ││
│  │  • Parallel Executor (Promise.all for independent steps)    ││
│  │  • State Machine (persisted in PostgreSQL)                  ││
│  │  • Variable Scope (execution-level context)                 ││
│  │  • Retry Logic (per-step exponential backoff)               ││
│  │  • Timeout Handling (per-step configurable)                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Step Runners                                               ││
│  │  • HTTP Request (REST, GraphQL, gRPC)                      ││
│  │  • Event Emitter (NATS publish)                           ││
│  │  • AI Completion (InsightAI integration)                  ││
│  │  • Database Query (QueryMind read-only)                   ││
│  │  • File Operation (VaultSpace CRUD)                        ││
│  │  • Notification (TeamSync message/email)                  ││
│  │  • Conditional Branch (if/else/switch)                      ││
│  │  • Loop (forEach, map, reduce)                            ││
│  │  • Parallel Branch (fork/join)                            ││
│  │  • Delay (wait N seconds/minutes/hours/days)              ││
│  │  • Approval (human pause/resume)                          ││
│  │  • Custom Code (sandboxed JavaScript VM)                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Observability                                              ││
│  │  • Execution timeline (per workflow run)                    ││
│  │  • Step-level metrics (duration, success rate)              ││
│  │  • Variable inspector (debug mode)                          ││
│  │  • Event audit log (every publish/consume)                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### DAG Execution Algorithm

```typescript
interface DAGNode {
  stepId: string;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
}

class DAGExecutor {
  private nodes: Map<string, DAGNode> = new Map();

  build(steps: Step[]): void {
    // Initialize nodes
    for (const step of steps) {
      this.nodes.set(step.id, {
        stepId: step.id,
        dependencies: step.dependsOn,
        dependents: [],
        status: 'pending',
      });
    }

    // Build reverse edges
    for (const step of steps) {
      for (const dep of step.dependsOn) {
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
        node.dependencies.every(
          (dep) => this.nodes.get(dep)?.status === 'completed'
        )
    );
  }

  markComplete(stepId: string, output: unknown): void {
    const node = this.nodes.get(stepId);
    if (!node) return;
    node.status = 'completed';
    node.output = output;
  }

  isComplete(): boolean {
    return Array.from(this.nodes.values()).every(
      (node) => node.status === 'completed' || node.status === 'skipped'
    );
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

  private markSkipped(stepId: string): void {
    const node = this.nodes.get(stepId);
    if (!node || node.status !== 'pending') return;
    node.status = 'skipped';
    for (const dependentId of node.dependents) {
      this.markSkipped(dependentId);
    }
  }
}
```

### Variable Context & Templating

```typescript
interface ExecutionContext {
  // System variables (read-only, injected by engine)
  trigger: TriggerEvent;
  workflow: WorkflowMetadata;
  execution: ExecutionMetadata;
  timestamp: string;
  tenantId: string;
  userId: string;

  // User-defined variables (read/write)
  variables: Record<string, unknown>;

  // Step outputs (read-only, populated as steps complete)
  steps: Record<string, StepOutput>;
}

// Templating engine (JSONata syntax)
const templateExample = {
  // Access trigger event data
  channelName: '{{ trigger.payload.channelName }}',

  // Access previous step output
  buildId: '{{ steps.deploy_step.output.buildId }}',

  // Conditional value
  message: '{{ $exists(steps.check_step.output.failed) ? "Build failed" : "Build OK" }}',

  // Array manipulation
  reviewers: '{{ trigger.payload.approvers[$contains(roles, "senior")] }}',
};
```

### Event-Driven Step Execution

```typescript
// When a step emits an event, the workflow engine doesn't block
// Instead, it publishes an event and waits for a response event

class EventDrivenStep implements StepRunner {
  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const requestId = crypto.randomUUID();

    // Publish request event
    await events.publish(`flowboard.step.${step.config.serviceAction}`, {
      tenantId: context.tenantId,
      requestId,
      payload: this.evaluateTemplate(step.config.payload, context),
      timeoutMs: step.timeoutMs,
    });

    // Wait for response event (with timeout)
    const response = await events.waitFor(
      `flowboard.step.response.${requestId}`,
      step.timeoutMs
    );

    if (response.status === 'success') {
      return { status: 'completed', output: response.payload };
    } else {
      return { status: 'failed', error: response.error };
    }
  }
}
```

### AI-Augmented Workflows

```typescript
// Step config for AI completion
const aiStep: Step = {
  id: 'summarize-and-decide',
  type: 'ai_completion',
  config: {
    model: 'gpt-4o',
    systemPrompt: `You are a DevOps assistant. Review the deployment logs
                   and decide if the deployment should proceed to production.
                   Respond with JSON: { "proceed": boolean, "reason": string }`,
    messages: [
      {
        role: 'user',
        content: 'Deployment logs: {{ steps.deploy_step.output.logs }}',
      },
    ],
    responseFormat: 'json',
    temperature: 0.2,
  },
  dependsOn: ['deploy_step'],
};

// The AI response can then drive conditional branching:
const conditionStep: Step = {
  id: 'check-ai-decision',
  type: 'condition',
  config: {
    expression: '{{ steps.summarize-and-decide.output.proceed === true }}',
    trueBranch: ['promote_to_prod'],
    falseBranch: ['rollback_staging', 'notify_team'],
  },
  dependsOn: ['summarize-and-decide'],
};
```

### Workflow Templates Library

```typescript
const builtInTemplates: WorkflowTemplate[] = [
  {
    id: 'onboarding-new-hire',
    name: 'New Hire Onboarding',
    description: 'Automatically set up a new employee across all systems',
    trigger: { type: 'event', eventSubject: 'auth.user.created.v1' },
    steps: [
      { id: '1', type: 'transform', config: { script: 'extract_user_info' } },
      { id: '2', type: 'event_emit', config: { subject: 'teamsync.channel.invite' } },
      { id: '3', type: 'event_emit', config: { subject: 'vaultspace.folder.create' } },
      { id: '4', type: 'event_emit', config: { subject: 'devpulse.user.track' } },
      { id: '5', type: 'notification', config: { message: 'Welcome to VistaFam!' } },
    ],
  },
  {
    id: 'incident-response',
    name: 'P1 Incident Response',
    description: 'Automated incident handling pipeline',
    trigger: { type: 'event', eventSubject: 'loglens.alert.triggered.v1' },
    steps: [
      { id: '1', type: 'condition', config: { expression: '{{ trigger.payload.severity === "P1" }}' } },
      { id: '2', type: 'event_emit', config: { subject: 'teamsync.channel.create', params: { name: 'incident-{{ trigger.payload.alertId }}' } } },
      { id: '3', type: 'event_emit', config: { subject: 'teamsync.message.send', params: { channel: '#incidents', content: 'P1 Alert: {{ trigger.payload.summary }}' } } },
      { id: '4', type: 'event_emit', config: { subject: 'flowboard.approval.required', params: { approvers: ['oncall-lead'] } } },
      { id: '5', type: 'event_emit', config: { subject: 'deployhub.rollback', params: { environment: 'production' } } },
    ],
  },
  {
    id: 'daily-standup-summary',
    name: 'Daily Standup Summary',
    description: 'AI-generated standup summary every morning',
    trigger: { type: 'schedule', cronExpression: '0 9 * * MON-FRI' },
    steps: [
      { id: '1', type: 'event_emit', config: { subject: 'devpulse.metric.query', params: { metric: 'commits_yesterday' } } },
      { id: '2', type: 'event_emit', config: { subject: 'devpulse.metric.query', params: { metric: 'deployments_yesterday' } } },
      { id: '3', type: 'ai_completion', config: { model: 'gpt-4o', prompt: 'Generate standup summary from: {{ steps.1.output }} and {{ steps.2.output }}' } },
      { id: '4', type: 'event_emit', config: { subject: 'teamsync.message.send', params: { channel: '#standup', content: '{{ steps.3.output }}' } } },
    ],
  },
];
```

### Workflow Execution Metrics

```typescript
// Published as Prometheus metrics
interface WorkflowMetrics {
  'flowboard_workflows_active': Gauge;           // By tenant
  'flowboard_executions_total': Counter;          // By status (completed, failed, cancelled)
  'flowboard_execution_duration_seconds': Histogram; // By workflow template
  'flowboard_steps_total': Counter;               // By step type and status
  'flowboard_step_duration_seconds': Histogram;   // By step type
  'flowboard_approvals_pending': Gauge;           // By tenant and approver
  'flowboard_dlq_messages': Counter;              // Failed executions
}
```
