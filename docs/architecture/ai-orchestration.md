# AI Orchestration Architecture

## 7. AI Orchestration Architecture

### Why InsightAI as a Dedicated Service?

LLM integration is not a feature—it's a cross-cutting concern with unique requirements:
- **Provider abstraction**: Must support OpenAI, Gemini, Claude, DeepSeek, Ollama without vendor lock-in
- **Cost management**: Token usage must be tracked per tenant for billing
- **Rate limiting**: LLM APIs have strict rate limits; need intelligent queuing
- **Safety & compliance**: PII filtering, content moderation, audit trails
- **Agent orchestration**: Future AI agents need memory, tools, and multi-step reasoning
- **Fallback chains**: If OpenAI is down, automatically failover to Claude

Isolating AI into InsightAI prevents every product from embedding its own LLM client with inconsistent patterns.

### InsightAI Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     INSIGHTAI SERVICE                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              LLM Provider Gateway                           ││
│  │                                                             ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          ││
│  │  │ OpenAI  │ │ Gemini  │ │ Claude  │ │DeepSeek │          ││
│  │  │ Adapter │ │ Adapter │ │ Adapter │ │ Adapter │          ││
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          ││
│  │       └─────────────┴───────────┴───────────┘               ││
│  │                     │                                       ││
│  │              ┌──────┴──────┐                                ││
│  │              │  Unified    │                                ││
│  │              │  Interface  │                                ││
│  │              │  (chat,     │                                ││
│  │              │  stream,    │                                ││
│  │              │  embed)     │                                ││
│  │              └──────┬──────┘                                ││
│  │                     │                                       ││
│  │              ┌──────┴──────┐                                ││
│  │              │  Fallback   │                                ││
│  │              │  Chain      │                                ││
│  │              │  (auto-retry│                                ││
│  │              │   on fail)  │                                ││
│  │              └─────────────┘                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Agent Runtime Engine                           ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          ││
│  │  │   Agent     │  │   Tool      │  │   Memory    │          ││
│  │  │   Registry  │  │   Registry  │  │   Manager   │          ││
│  │  │             │  │             │  │             │          ││
│  │  │  • Define   │  │  • Register │  │  • Short    │          ││
│  │  │    agent    │  │    tools    │  │    term     │          ││
│  │  │    config   │  │  • Schema   │  │  • Long     │          ││
│  │  │  • Select   │  │    valid.   │  │    term     │          ││
│  │  │    model    │  │  • Execute  │  │  • Context  │          ││
│  │  │  • Set      │  │    via NATS │  │    window   │          ││
│  │  │    system   │  │             │  │             │          ││
│  │  │    prompt   │  │  Tools:     │  │  • Tenant-  │          ││
│  │  │             │  │  - queryDB  │  │    isolated │          ││
│  │  │             │  │  - sendMsg  │  │  • Vector   │          ││
│  │  │             │  │  - runWorkflow│ │    search   │          ││
│  │  │             │  │  - searchDocs│  │    (pgvector│          ││
│  │  │             │  │  - createTicket│ │    or Qdrant│          ││
│  │  │             │  │             │  │    )        │          ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Multi-Tenant Isolation                         ││
│  │                                                             ││
│  │  • Per-tenant model configuration                           ││
│  │  • Per-tenant token usage tracking                          ││
│  │  • Per-tenant rate limits                                   ││
│  │  • Per-tenant API key storage (encrypted)                   ││
│  │  • Tenant-specific system prompts                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Safety & Compliance                            ││
│  │                                                             ││
│  │  • PII detection & redaction (presidio/microsoft)           ││
│  │  • Content moderation (OpenAI Moderation API)               ││
│  │  • Prompt injection detection                               ││
│  │  • Output filtering per tenant policy                       ││
│  │  • Full request/response audit logging                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### LLM Provider Adapter Interface

```typescript
interface LLMProvider {
  name: string;
  models: string[];

  chat(params: ChatParams): Promise<ChatResponse>;
  stream(params: ChatParams): AsyncIterable<ChatChunk>;
  embed(params: EmbedParams): Promise<EmbedResponse>;

  // Cost tracking
  getCost(usage: TokenUsage): number;
}

interface ChatParams {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  responseFormat?: 'text' | 'json';
}

interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
}
```

### Provider Fallback Chain

```typescript
const defaultFallbackChain = [
  { provider: 'openai', model: 'gpt-4o' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  { provider: 'google', model: 'gemini-1.5-pro' },
  { provider: 'deepseek', model: 'deepseek-chat' },
  { provider: 'ollama', model: 'llama3.1:70b' }, // on-prem fallback
];

// Usage:
// 1. Try OpenAI
// 2. If rate-limited (429) or down (5xx), try Anthropic
// 3. Continue down chain
// 4. Log which provider succeeded for analytics
```

### Agent Tool System

Agents can invoke tools via events, keeping InsightAI loosely coupled:

```typescript
// Tool definition
interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown, context: AgentContext) => Promise<ToolResult>;
}

// Built-in tools (registered at startup)
const builtInTools: Tool[] = [
  {
    name: 'query_database',
    description: 'Execute a read-only SQL query',
    parameters: z.object({ sql: z.string(), explanation: z.string() }),
    execute: async (params, ctx) => {
      // Publish event to QueryMind service
      const result = await events.requestReply(
        'querymind.execute.safe',
        { tenantId: ctx.tenantId, sql: params.sql }
      );
      return { content: result.data };
    },
  },
  {
    name: 'send_message',
    description: 'Send a message to a TeamSync channel',
    parameters: z.object({ channelId: z.string(), text: z.string() }),
    execute: async (params, ctx) => {
      events.publish('teamsync.message.send', {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        payload: params,
      });
      return { content: 'Message sent' };
    },
  },
  {
    name: 'run_workflow',
    description: 'Trigger a FlowBoard workflow',
    parameters: z.object({ workflowId: z.string(), inputs: z.record(z.unknown()) }),
    execute: async (params, ctx) => {
      events.publish('flowboard.workflow.trigger', {
        tenantId: ctx.tenantId,
        payload: params,
      });
      return { content: 'Workflow triggered' };
    },
  },
];
```

### Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY LAYERS                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Conversation Memory (per chat session)           │
│  • Stored in PostgreSQL (messages table)                    │
│  • Window: last N messages (configurable, default 20)        │
│  • Included in every LLM request                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Working Memory (per user, per tenant)              │
│  • Stored in Redis (TTL: 24 hours)                          │
│  • Key facts extracted by LLM during conversation         │
│  • "User prefers Python", "Project deadline is Friday"    │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Long-Term Memory (vector search)                   │
│  • Stored in pgvector or Qdrant                             │
│  • Embeddings of important conversations                    │
│  • Semantic search across all past interactions           │
│  • Tenant-isolated collections                              │
└─────────────────────────────────────────────────────────────┘
```

### Token Usage & Billing

```typescript
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Every LLM call is recorded:
// 1. In PostgreSQL (insightai.usage table)
// 2. Emitted as `insightai.tokens.used` event
// 3. Aggregated per tenant per hour for billing

// Cost calculation per provider:
const costPer1KTokens = {
  'openai:gpt-4o': { input: 0.005, output: 0.015 },
  'anthropic:claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'google:gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
  'deepseek:deepseek-chat': { input: 0.00014, output: 0.00028 },
  'ollama:llama3.1:70b': { input: 0, output: 0 }, // on-prem = free
};
```

### Streaming Architecture

For real-time chat UI, InsightAI supports Server-Sent Events (SSE):

```
Client ──HTTP POST /api/v1/insightai/chat/stream──> InsightAI
                                                         │
                                                         ▼
                                              ┌──────────────────┐
                                              │  LLM Provider    │
                                              │  (SSE streaming) │
                                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Token Buffer    │
                                              │  (flush every    │
                                              │   50ms or        │
                                              │   10 tokens)     │
                                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  SSE to Client   │
                                              │  + NATS event    │
                                              │  for audit       │
                                              └──────────────────┘
```

### Event Contract

```typescript
// Events published by InsightAI
interface InsightAIEvents {
  'insightai.conversation.started': {
    conversationId: string;
    tenantId: string;
    userId: string;
    agentId: string;
  };
  'insightai.message.generated': {
    conversationId: string;
    messageId: string;
    tenantId: string;
    model: string;
    provider: string;
    usage: TokenUsage;
    latencyMs: number;
  };
  'insightai.tokens.used': {
    tenantId: string;
    userId: string;
    model: string;
    provider: string;
    usage: TokenUsage;
    costUsd: number;
  };
  'insightai.tool.called': {
    conversationId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    result: unknown;
    latencyMs: number;
  };
  'insightai.agent.action': {
    agentId: string;
    tenantId: string;
    action: string;
    targetService: string;
  };
}
```

### AI Agent Orchestration (Future)

The architecture supports future multi-agent systems:

- **Specialist Agents**: Each product can have a domain-specific agent (CodeAgent, DataAgent, OpsAgent)
- **Coordinator Agent**: Routes user requests to the right specialist
- **Agent Swarm**: Multiple agents collaborate on complex tasks via events
- **Human-in-the-loop**: Agent actions requiring approval emit `insightai.action.pending` events
