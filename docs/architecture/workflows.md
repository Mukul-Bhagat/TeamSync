# Workflow Execution Flow

## 12. Workflow Execution Flow

### FlowBoard as the Central Orchestrator

FlowBoard is the system's "nervous system." It listens to events from all services and triggers automated sequences. This is not just a visual workflow builder—it's a reliable, stateful execution engine.

### Workflow Definition Model

```typescript
interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: Trigger;
  steps: Step[];
  variables: Record<string, VariableDef>;
  createdAt: Date;
  updatedAt: Date;
}

interface Trigger {
  type: 'event' | 'schedule' | 'webhook' | 'manual';
  // For event triggers:
  eventSubject?: string;      // e.g., "teamsync.message.sent.v1"
  eventFilter?: EventFilter;   // e.g., { channelName: "deployments" }
  // For schedule triggers:
  cronExpression?: string;    // e.g., "0 9 * * MON"
  // For webhook triggers:
  webhookPath?: string;
}

interface Step {
  id: string;
  name: string;
  type: StepType;
  config: StepConfig;
  dependsOn: string[];        // DAG dependencies
  retryPolicy: RetryPolicy;
  timeoutMs: number;
}

type StepType =
  | 'condition'      // If/else logic
  | 'delay'          // Wait N seconds/minutes/hours
  | 'http_request'   // Call external API
  | 'event_emit'     // Publish NATS event
  | 'ai_completion'  // Call InsightAI
  | 'database_query' // Read from QueryMind
  | 'notification'   // Send TeamSync message/email
  | 'parallel'       // Execute branches in parallel
  | 'loop'           // Iterate over collection
  | 'transform'      // JSONata/JS data transformation
  | 'approval'       // Human-in-the-loop
  | 'custom_code';   // Sandboxed JavaScript
```

### Execution Engine Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLOWBOARD ENGINE                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Trigger Listener (NATS consumer for each active workflow)  ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Event Matcher (filter + tenant isolation)                ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Execution Scheduler (BullMQ job enqueue)                 ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  DAG Executor (topological sort, parallel where possible)  ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Step Runner (calls services via events or HTTP)          ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  State Persistence (PostgreSQL state machine)           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### State Machine Persistence

```sql
CREATE TABLE flowboard.executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  workflow_id UUID NOT NULL,
  trigger_event JSONB,           -- The event that started this execution
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, paused
  current_step_id TEXT,
  context JSONB NOT NULL DEFAULT '{}',    -- Variable store (JSON)
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE flowboard.execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES flowboard.executions(id),
  step_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, skipped
  input JSONB,
  output JSONB,
  error JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0
);
```

### Execution Flow Example: "New User Onboarding"

```
Trigger: auth.user.created.v1
│
├─ Step 1: [transform]
│   │  Extract user email, name, tenantId from event
│   │  output: { email, name, tenantId, userId }
│   │
├─ Step 2: [parallel]
│   │  Branch A ──> [event_emit] teamsync.channel.invite
│   │               (Invite to #general)
│   │  Branch B ──> [event_emit] teamsync.message.send
│   │               (Welcome DM from bot)
│   │  Branch C ──> [ai_completion]
│   │               (Generate personalized welcome message)
│   │               output: { welcomeMessage }
│   │
├─ Step 3: [condition]
│   │  IF user.email.endsWith('@acme-corp.com')
│   │    THEN Step 4a
│   │    ELSE Step 4b
│   │
├─ Step 4a: [event_emit] vaultspace.folder.create
│   │  (Create "My Workspace" folder)
│   │
├─ Step 4b: [event_emit] teamsync.message.send
│   │  (Send getting-started guide link)
│   │
├─ Step 5: [event_emit] devpulse.metric.track
│   │  (Track "user_onboarded" metric)
│   │
└─ Step 6: [notification]
    │  (Notify admin that new user joined)
    │
    DONE
```

### Parallel Execution

```typescript
// DAG topological sort + parallel execution
async function executeWorkflow(execution: Execution) {
  const workflow = await getWorkflow(execution.workflowId);
  const dag = buildDAG(workflow.steps);

  while (!dag.isComplete()) {
    const readySteps = dag.getReadySteps();

    // Execute all ready steps in parallel
    await Promise.all(
      readySteps.map(step => executeStep(execution, step))
    );

    // Update DAG with results
    for (const step of readySteps) {
      dag.markComplete(step.id, step.output);
    }
  }
}
```

### Error Handling & Compensation

```typescript
interface CompensationAction {
  stepId: string;
  action: 'rollback' | 'notify' | 'retry' | 'escalate';
  config: Record<string, unknown>;
}

// When a step fails:
// 1. Mark execution as "failed"
// 2. Run compensation actions in reverse order
// 3. Publish `flowboard.workflow.failed` event
// 4. Send alert to ops channel

async function handleStepFailure(
  execution: Execution,
  failedStep: Step,
  error: Error
) {
  await persistFailure(execution, failedStep, error);

  // Compensation
  const completedSteps = getCompletedStepsInReverse(execution);
  for (const step of completedSteps) {
    if (step.compensation) {
      await runCompensation(step);
    }
  }

  events.publish('flowboard.workflow.failed', {
    tenantId: execution.tenantId,
    workflowId: execution.workflowId,
    executionId: execution.id,
    failedStep: failedStep.id,
    error: error.message,
  });
}
```

### Human-in-the-Loop (Approval Steps)

```typescript
// Approval step pauses execution
async function executeApprovalStep(execution: Execution, step: Step) {
  // 1. Create approval request
  const approval = await createApprovalRequest({
    tenantId: execution.tenantId,
    executionId: execution.id,
    stepId: step.id,
    approvers: step.config.approvers,
    deadline: new Date(Date.now() + step.config.timeoutMs),
  });

  // 2. Publish event (TeamSync will notify approvers)
  events.publish('flowboard.approval.required', {
    tenantId: execution.tenantId,
    approvalId: approval.id,
    approvers: step.config.approvers,
    message: step.config.message,
  });

  // 3. Execution is PAUSED
  await execution.pause();
}

// When approver responds:
events.subscribe('flowboard.approval.responded', async (event) => {
  const { approvalId, approved, comment } = event.payload;
  const approval = await getApproval(approvalId);

  if (approved) {
    await execution.resume(approval.executionId, {
      stepOutput: { approved: true, comment },
    });
  } else {
    await execution.fail(approval.executionId, {
      error: `Approval denied: ${comment}`,
    });
  }
});
```

### Scheduling (Cron Triggers)

```typescript
// BullMQ repeatable jobs for cron triggers
const queue = new BullMQ.Queue('flowboard-scheduled', { connection: redis });

// When workflow is activated with cron trigger:
await queue.add(
  `workflow:${workflow.id}`,
  { workflowId: workflow.id, tenantId: workflow.tenantId },
  { repeat: { cron: workflow.trigger.cronExpression } }
);

// Worker picks up scheduled jobs and starts executions
```

### Workflow Templates

Pre-built templates for common scenarios:

| Template | Description | Services Used |
|---|---|---|
| `new-user-onboarding` | Welcome flow for new team members | AuthSphere → TeamSync → VaultSpace |
| `deployment-pipeline` | CI/CD with approvals | DeployHub → FlowBoard → TeamSync |
| `incident-response` | Alert → Notify → Create ticket → Escalate | LogLens → TeamSync → FlowBoard |
| `data-backup` | Scheduled DB backup → Verify → Notify | SchemaForge → VaultSpace → TeamSync |
| `content-moderation` | Upload → AI check → Approve/Reject | VaultSpace → InsightAI → TeamSync |
| `security-audit` | Daily permission review → Alert anomalies | AuthSphere → InsightAI → LogLens |
