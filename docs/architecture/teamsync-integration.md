# TeamSync Integration Model

## 13. TeamSync Integration Model

### Why TeamSync is the Collaboration Hub?

TeamSync is the human-facing product in the VistaFam ecosystem. While other services handle infrastructure, workflows, and AI, TeamSync is where users actually interact. It must integrate deeply with the entire ecosystem without becoming a monolith.

### TeamSync Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAMSYNC PRODUCT                             │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │    Web Client    │  │    API Service   │                   │
│  │    (Next.js)     │  │    (Fastify)     │                   │
│  │                  │  │                  │                   │
│  │  • App Router    │  │  • REST API      │                   │
│  │  • Real-time     │  │  • Socket.IO     │                   │
│  │    (Socket.IO)   │  │  • Event         │                   │
│  │  • AI Chat       │  │    Publisher     │                   │
│  │    (InsightAI)   │  │  • Auth          │                   │
│  │  • File Previews │  │    Validation    │                   │
│  │    (VaultSpace)  │  │  • Multi-tenant  │                   │
│  │                  │  │    Queries         │                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                  │
│  Core Features:                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Channels │ │ Messages │ │ Presence │ │ Threads  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Reactions │ │Mentions  │ │Search    │ │Notifications│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ File     │ │ Voice    │ │ Huddles  │ │ AI Bot   │          │
│  │ Sharing  │ │ Messages │ │          │ │ Integr.  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points with Other Services

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEAMSYNC INTEGRATIONS                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AuthSphere (Identity)                                     ││
│  │  • Login via OAuth2 redirect                                ││
│  │  • JWT validation on every request                          ││
│  │  • RBAC: who can create channels, send DMs, admin rooms   ││
│  │  • User profile sync (avatar, name, status)                 ││
│  │  • Session management (list active devices)                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  VaultSpace (Files & Assets)                                ││
│  │  • File upload → VaultSpace API → return asset URL          ││
│  │  • Rich message attachments                                 ││
│  │  • Image/video previews via presigned URLs                  ││
│  │  • File search in TeamSync search (delegates to VaultSpace) ││
│  │  • AI-generated asset tags visible in file sharing UI         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  FlowBoard (Workflows & Automation)                         ││
│  │  • Channel messages can trigger FlowBoard workflows         ││
│  │  • Workflow notifications delivered as TeamSync messages      ││
│  │  • Bot messages from FlowBoard automation                   ││
│  │  • Slash commands trigger workflows (e.g., /deploy)         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  InsightAI (AI Assistant)                                   ││
│  │  • AI bot in channels (e.g., @VistaBot summarize)         ││
│  │  • AI-generated message summaries                           ││
│  │  • Smart replies and draft suggestions                    ││
│  │  • Semantic search across messages (vector search)          ││
│  │  • Sentiment analysis for moderation                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  DeployHub (Deployment Notifications)                       ││
│  │  • Build status updates in #deployments channel             ││
│  │  • Deployment approval requests via DMs                     ││
│  │  • Rollback notifications with one-click action             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  LogLens (Alert Notifications)                              ││
│  │  • P1 alerts sent to #incidents channel                    ││
│  │  • Log query results shared in threads                      ││
│  │  • Dashboard screenshots in standup threads                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  DevPulse (Analytics in Chat)                                ││
│  │  • Daily standup summaries with metrics                     ││
│  │  • Sprint velocity reports in #engineering                  ││
│  │  • DORA metrics dashboards shared as messages               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Event Contract for TeamSync

```typescript
// Events TeamSync PUBLISHES
interface TeamSyncEvents {
  'teamsync.message.sent': {
    messageId: string;
    channelId: string;
    threadId?: string;
    authorId: string;
    content: string;
    mentions: string[];
    attachments: Attachment[];
    timestamp: string;
  };
  'teamsync.message.edited': {
    messageId: string;
    channelId: string;
    newContent: string;
    editedAt: string;
  };
  'teamsync.message.deleted': {
    messageId: string;
    channelId: string;
    deletedBy: string;
  };
  'teamsync.channel.created': {
    channelId: string;
    name: string;
    type: 'public' | 'private' | 'dm';
    createdBy: string;
  };
  'teamsync.user.typing': {
    userId: string;
    channelId: string;
    timestamp: string;
  };
  'teamsync.presence.changed': {
    userId: string;
    status: 'online' | 'away' | 'dnd' | 'offline';
    lastSeen: string;
  };
  'teamsync.notification.created': {
    userId: string;
    type: 'mention' | 'reply' | 'reaction' | 'workflow' | 'system';
    sourceId: string;
    message: string;
  };
}

// Events TeamSync CONSUMES
interface TeamSyncSubscriptions {
  'auth.user.login':        // Welcome online user
  'auth.user.logout':       // Update presence
  'flowboard.workflow.step.executed':  // Workflow notifications
  'flowboard.approval.required':         // Approval DMs
  'deployhub.build.completed':          // Build status
  'deployhub.deployment.promoted':       // Deploy status
  'loglens.alert.triggered':             // Alert messages
  'insightai.agent.action':              // AI bot messages
  'vaultspace.asset.tagged':             // File share enrichment
}
```

### Slash Commands → FlowBoard Integration

```
User types: "/deploy staging frontend"
│
├─> TeamSync parses command
├─> Publishes `teamsync.slash_command.invoked`
│   payload: { command: "deploy", args: ["staging", "frontend"], userId, channelId }
│
├─> FlowBoard has trigger on `teamsync.slash_command.invoked`
│   Filter: command === "deploy"
│
├─> FlowBoard executes "Deploy Frontend to Staging" workflow
│   Step 1: Validate user has deploy:frontend permission
│   Step 2: Call DeployHub API to trigger build
│   Step 3: Wait for build completion (event-based)
│   Step 4: Publish result to channel
│
└─> TeamSync receives `flowboard.workflow.completed`
    Bot posts: "Deployment to staging initiated. Build ID: #1234"
```

### AI Bot Integration

```
User mentions @VistaBot in #engineering:
"@VistaBot summarize last 50 messages and create a Jira ticket"
│
├─> TeamSync publishes `teamsync.message.sent` with mentions: ["vistabot"]
│
├─> InsightAI subscribes to messages mentioning the bot
│
├─> InsightAI agent:
│   1. Calls TeamSync API (internal) to fetch last 50 messages
│   2. Sends messages to LLM for summarization
│   3. Calls FlowBoard (via event) to create workflow ticket
│   4. Publishes response as `teamsync.message.send` event
│
└─> TeamSync displays bot response in channel
```

### Multi-Tenant Isolation in TeamSync

```sql
-- Every TeamSync entity includes tenant_id
CREATE TABLE teamsync.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('public', 'private', 'dm')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- RLS enforced
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES authsphere.tenants(id)
);

-- Users can only see channels in their tenant
CREATE POLICY tenant_isolation ON teamsync.channels
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Cross-tenant access is impossible at DB level
```

### Search Architecture

```
User searches: "deployment failed yesterday"
│
├─> TeamSync API receives search request
├─> Parallel queries:
│   1. PostgreSQL full-text: message content (recent 30 days)
│   2. InsightAI vector search: semantic meaning (all time)
│   3. VaultSpace: file names and AI tags
│
├─> Results merged and ranked
│   • Exact matches first
│   • Semantic matches second
│   • File results third
│
└─> Return unified result set with facets
```

### Notification Delivery Strategy

```typescript
interface NotificationDelivery {
  // Real-time (primary)
  realtime: {
    socketRoom: string;        // tenant:{tenantId}:user:{userId}
    eventName: string;         // "notification:new"
    payload: Notification;
  };

  // Push (fallback for offline users)
  push: {
    enabled: boolean;
    providers: ('web_push' | 'fcm' | 'apns')[];
  };

  // Email (for important notifications when user is away > 5 min)
  email: {
    enabled: boolean;
    delayMs: number;           // 300000 (5 min)
    template: string;
  };

  // In-app (always)
  inbox: {
    badge: boolean;
    sound: boolean;
  };
}
```
