# Authentication Architecture

## 6. Authentication Architecture

### Why AuthSphere as Centralized Identity Provider?

A single source of truth for identity eliminates the "identity silo" problem where each service manages its own users. AuthSphere acts as the system's root of trust, enabling:

- **Single Sign-On (SSO)**: Users authenticate once, access all products
- **Consistent RBAC**: One permission model across 11 products
- **Unified Audit Trail**: Every login, role change, permission grant is logged centrally
- **Tenant Isolation**: Strong boundaries between organizations
- **Future-proofing**: Easy to add SAML, OIDC, SCIM later

### Auth Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Web App    │  │  Mobile App │  │   CLI/SDK   │             │
│  │ (Next.js)   │  │ (React Nat) │  │  (Node.js)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHSPHERE (IdP)                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  OAuth2 / OIDC Provider (Fastify + @fastify/oauth2)       ││
│  │  • Authorization Code Flow (PKCE for SPAs)                  ││
│  │  • Client Credentials Flow (M2M / service-to-service)       ││
│  │  • Refresh Token Rotation                                   ││
│  │  • JWT Access Tokens (RS256, 15 min TTL)                    ││
│  │  • Refresh Tokens (AES-256-GCM encrypted in DB, 7 day TTL) ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Tenant    │  │    User     │  │    Role     │             │
│  │  Management │  │  Management │  │  & Permission│             │
│  │             │  │             │  │  Engine      │             │
│  │  • Create   │  │  • Register │  │  • Create    │             │
│  │  • Configure│  │  • Profile  │  │  • Assign    │             │
│  │  • Billing  │  │  • MFA      │  │  • Check     │             │
│  │  • Custom   │  │  • Deactivate│ │  • Inherit   │             │
│  │    Domain   │  │             │  │              │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Audit Logger (publishes auth.audit.* events)              ││
│  │  • login.success / login.failed                            ││
│  │  • role.changed / permission.denied                        ││
│  │  • token.refresh / token.revoked                           ││
│  │  • user.created / user.deactivated                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
          │
          │ JWT Access Token (RS256 signed)
          │ Contains: sub, tenantId, roles[], permissions[], iss, aud, exp
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              ALL OTHER SERVICES (Resource Servers)              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  @vistafam/auth-client (shared package)                     ││
│  │  • verifyJWT(token, { issuer, audience })                   ││
│  │  • extractTenantId(token)                                   ││
│  │  • extractUserId(token)                                       ││
│  │  • checkPermission(token, requiredPermission)               ││
│  │  • cache public key in Redis (5 min TTL)                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Every incoming request:                                         │
│  1. Extract token from Authorization header                    │
│  2. Verify signature using AuthSphere's public key           │
│  3. Check expiry                                               │
│  4. Extract tenantId + roles + permissions                     │
│  5. Attach to request context (Fastify decorators)            │
│  6. Enforce RBAC on route handlers                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Token Structure

```typescript
interface VistaFamAccessToken {
  // Registered claims
  iss: string;        // "https://authsphere.vistafam.app"
  sub: string;        // User UUID
  aud: string;        // Service identifier (e.g., "teamsync-api")
  exp: number;        // Expiration (15 minutes from issuance)
  iat: number;        // Issued at
  jti: string;        // Unique token ID (for revocation)

  // Custom claims
  tenantId: string;   // Organization UUID
  tenantSlug: string; // "acme-corp"
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  roles: string[];      // ["admin", "developer"]
  permissions: string[];// ["teamsync:channel:create", "vaultspace:asset:read"]
  sessionId: string;  // For session revocation
  mfaVerified: boolean;
}
```

### RBAC Model

```
Tenant
  └── Roles
        ├── Permissions (granular, resource:action)
        └── Users (many-to-many)

Example Permission Format:
  "{product}:{resource}:{action}"

  "teamsync:channel:create"
  "teamsync:channel:read"
  "teamsync:channel:delete"
  "teamsync:message:send"
  "flowboard:workflow:execute"
  "flowboard:workflow:admin"
  "vaultspace:asset:upload"
  "vaultspace:asset:read"
  "insightai:agent:interact"
  "insightai:model:configure"
  "admin:*"  // Wildcard admin
```

### Service-to-Service Authentication

Internal services communicate using **Client Credentials** flow:

```
Service A (e.g., FlowBoard)
  │
  ├──> Requests token from AuthSphere
  │    grant_type=client_credentials
  │    client_id=flowboard-service
  │    client_secret=<rotated secret>
  │
  ├──> Receives JWT with:
  │    sub="service:flowboard"
  │    permissions=["internal:event:publish", "internal:api:call"]
  │
  └──> Uses token for all internal API calls
```

### Multi-Tenancy Isolation

Every database query, cache key, event, and Socket.IO room is scoped by `tenantId`:

```typescript
// Database row-level security (PostgreSQL)
CREATE POLICY tenant_isolation ON messages
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

// Redis cache keys
const cacheKey = `cache:${tenantId}:${resourceType}:${resourceId}`;

// NATS subject (for tenant-scoped events)
const subject = `teamsync.${tenantId}.message.sent.v1`;
```

### MFA & Security

- **TOTP**: Google Authenticator / Authy compatible
- **WebAuthn**: FIDO2 security keys for enterprise tenants
- **Session Management**: Active sessions listed per user, admin can revoke
- **Brute Force Protection**: 5 failed attempts → 15 min lockout
- **Token Binding**: Optional device fingerprinting for high-security tenants

### Token Revocation

Despite JWTs being stateless, we need revocation capability:

- **Short TTL**: Access tokens expire in 15 minutes
- **Revocation List**: Redis Set of revoked `jti`s, checked on every request (cached 5 min)
- **Session Kill**: Revoking a session ID invalidates all tokens with that `sessionId`
- **Tenant Lock**: Disabling a tenant adds `tenantId` to blocklist

### Audit Events Published

```typescript
// AuthSphere publishes these events to NATS
interface AuthAuditEvents {
  'auth.user.created': { userId, tenantId, email, invitedBy };
  'auth.user.login': { userId, tenantId, method, ip, userAgent, mfaUsed };
  'auth.user.login.failed': { email, tenantId, reason, ip, userAgent };
  'auth.user.logout': { userId, tenantId, sessionId };
  'auth.role.assigned': { userId, tenantId, role, assignedBy };
  'auth.role.revoked': { userId, tenantId, role, revokedBy };
  'auth.permission.denied': { userId, tenantId, permission, resource, ip };
  'auth.token.revoked': { userId, tenantId, tokenJti, reason };
  'auth.tenant.created': { tenantId, name, slug, createdBy };
  'auth.tenant.suspended': { tenantId, reason, suspendedBy };
}
```

### Why Not Use an External IdP (Auth0, Clerk)?

- **Cost**: External IdPs charge per MAU. At 100K users, self-hosted is significantly cheaper
- **Data Sovereignty**: Enterprise customers may require data residency
- **Deep Integration**: Custom RBAC, tenant-aware features, and audit requirements are hard to express in generic IdPs
- **Event Emission**: Need fine-grained auth events for the event-driven architecture
- **AI Integration**: AuthSphere will eventually support AI-assisted permission recommendations
