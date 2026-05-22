# Security Strategy

## 18. Security Strategy

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
│                                                                  │
│  Layer 1: Edge Security (NGINX)                                 │
│  ├── TLS 1.3 (mandatory, no fallback to 1.2)                  │
│  ├── HSTS headers (max-age=31536000; includeSubDomains)        │
│  ├── DDoS protection (rate limiting per IP)                    │
│  ├── WAF rules (SQL injection, XSS, path traversal)            │
│  ├── Geo-blocking (optional per tenant)                        │
│  └── IP allowlisting (enterprise tenants)                      │
│                                                                  │
│  Layer 2: Gateway Security (API Gateway)                        │
│  ├── JWT validation (RS256, 15 min expiry)                     │
│  ├── Tenant isolation (every request scoped to tenant)         │
│  ├── RBAC enforcement (permission checks per route)            │
│  ├── Rate limiting (per tenant, per user, per API key)         │
│  ├── Request size limits (10MB max)                              │
│  ├── CORS policy (whitelist per tenant)                        │
│  └── API key management (for M2M integrations)                  │
│                                                                  │
│  Layer 3: Service Security (Microservices)                       │
│  ├── Input validation (Zod schemas on every endpoint)          │
│  ├── Output encoding (prevent XSS in API responses)             │
│  ├── SQL injection prevention (parameterized queries only)      │
│  ├── NoSQL injection prevention (validate before Mongo/Redis)    │
│  ├── File upload validation (type, size, malware scan)           │
│  └── Secret management (no secrets in code, inject via env)      │
│                                                                  │
│  Layer 4: Data Security                                          │
│  ├── Encryption at rest (PostgreSQL TDE, MinIO SSE-S3)        │
│  ├── Encryption in transit (TLS 1.3 for all connections)        │
│  ├── Field-level encryption (PII in PostgreSQL: AES-256-GCM)    │
│  ├── Key rotation (automatic every 90 days)                     │
│  └── Data masking (logs show partial emails, full in DB)        │
│                                                                  │
│  Layer 5: Identity Security (AuthSphere)                        │
│  ├── Password policy (min 12 chars, complexity requirements)   │
│  ├── Bcrypt hashing (cost factor 12)                            │
│  ├── MFA (TOTP + WebAuthn for enterprise)                        │
│  ├── Session binding (device fingerprinting)                   │
│  ├── Brute force protection (5 fails → 15 min lockout)        │
│  └── Account lockout (30 days inactive → require re-auth)        │
│                                                                  │
│  Layer 6: Network Security                                       │
│  ├── Service mesh (mTLS between services)                      │
│  ├── Network segmentation (DB only accessible from services)   │
│  ├── VPN required for admin access                               │
│  └── VPC peering for cloud deployments                           │
│                                                                  │
│  Layer 7: Operational Security                                   │
│  ├── Audit logging (every auth event, every permission check)   │
│  ├── Security scanning (SAST/DAST in CI/CD)                     │
│  ├── Dependency scanning (Snyk/Trivy for CVEs)                  │
│  ├── Penetration testing (quarterly)                             │
│  └── Incident response plan (documented, tested annually)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication & Authorization

```typescript
// Token types
interface TokenTypes {
  accessToken: {
    type: 'JWT';
    algorithm: 'RS256';
    expiry: '15 minutes';
    contains: ['sub', 'tenantId', 'roles', 'permissions'];
    storage: 'HttpOnly Secure cookie OR Authorization header';
  };
  refreshToken: {
    type: 'Opaque token (UUID)';
    storage: 'HttpOnly Secure cookie';
    expiry: '7 days';
    rotation: 'Yes (new refresh token on every use)';
    revocation: 'Redis blocklist';
  };
  serviceToken: {
    type: 'JWT';
    algorithm: 'RS256';
    expiry: '1 hour';
    contains: ['sub: service:name', 'permissions: internal:*'];
    storage: 'Environment variable (client_secret)';
  };
}

// RBAC enforcement
function enforcePermission(requiredPermission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userPermissions = req.user?.permissions || [];
    const hasPermission = userPermissions.some(
      (p) => p === requiredPermission || p === 'admin:*'
    );
    if (!hasPermission) {
      events.publish('auth.permission.denied', {
        userId: req.user?.id,
        tenantId: req.tenantId,
        permission: requiredPermission,
        resource: req.url,
      });
      reply.status(403).send({ error: 'Permission denied' });
    }
  };
}

// Usage:
app.get('/api/v1/vaultspace/assets', {
  preHandler: [authenticate, enforcePermission('vaultspace:asset:read')],
}, handler);
```

### Secret Management

```typescript
// No secrets in code or config files
// All secrets injected at runtime

interface SecretSources {
  development: 'Environment variables (not committed)';
  staging: 'Docker secrets / AWS Secrets Manager';
  production: 'HashiCorp Vault / AWS Secrets Manager / Azure Key Vault';
}

// Secret rotation
interface SecretRotation {
  jwtSigningKeys: 'Automatic every 90 days, with 7-day overlap';
  databasePasswords: 'Manual rotation every 180 days';
  apiKeys: 'Per-tenant, rotate on suspicion or quarterly';
  serviceSecrets: 'Automatic every 30 days';
}

// In Docker Compose:
// secrets:
//   db_password:
//     file: ./secrets/db_password.txt
//   jwt_private_key:
//     file: ./secrets/jwt_private.pem
```

### Input Validation & Sanitization

```typescript
// Every endpoint uses Zod validation
const CreateChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/i),
  description: z.string().max(500).optional(),
  type: z.enum(['public', 'private', 'dm']),
  members: z.array(z.uuid()).max(100).optional(),
});

// File upload validation
const UploadSchema = z.object({
  file: z.instanceof(Blob).refine(
    (f) => f.size <= 100 * 1024 * 1024, // 100MB max
    'File too large'
  ).refine(
    (f) => ['image/', 'application/pdf', 'text/'].some((t) => f.type.startsWith(t)),
    'Invalid file type'
  ),
});

// Output encoding (prevent XSS)
function sanitizeOutput(data: unknown): unknown {
  if (typeof data === 'string') {
    return escapeHtml(data);
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeOutput);
  }
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, sanitizeOutput(v)])
    );
  }
  return data;
}
```

### Audit Logging

```typescript
// Every security-relevant action is logged
interface AuditEvent {
  id: string;
  timestamp: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  result: 'success' | 'failure' | 'denied';
  metadata: {
    ipAddress: string;
    userAgent: string;
    sessionId: string;
    reason?: string;
  };
}

// Audit events are published to NATS and stored in:
// 1. PostgreSQL (authsphere.audit_logs) for 90 days
// 2. Loki for long-term search
// 3. S3/MinIO archive after 90 days (compliance)
```

### Content Security Policy (CSP)

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.vistafam.app;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https://*.vistafam.app https://minio.vistafam.app;
  connect-src 'self' https://api.vistafam.app wss://realtime.vistafam.app;
  font-src 'self' https://fonts.gstatic.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### Data Privacy & Compliance

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA PRIVACY                                │
│                                                                  │
│  GDPR Compliance:                                                │
│  ├── Data minimization (only collect what's needed)             │
│  ├── Right to erasure (DELETE /api/v1/authsphere/me)            │
│  ├── Right to access (EXPORT /api/v1/authsphere/me/data)        │
│  ├── Data portability (JSON export)                             │
│  └── Privacy by design (tenant isolation, encryption)            │
│                                                                  │
│  Data Classification:                                            │
│  ├── Public: Marketing content, public channels                 │
│  ├── Internal: Team messages, workflow logs                     │
│  ├── Confidential: API keys, config values                    │
│  └── Restricted: Passwords, MFA secrets, audit logs           │
│                                                                  │
│  Retention Policies:                                             │
│  ├── Messages: 90 days (configurable per tenant)                │
│  ├── Audit logs: 1 year (compliance)                             │
│  ├── AI conversations: 30 days (with user consent)             │
│  └── Deleted data: Soft delete → hard delete after 30 days       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
