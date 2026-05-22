/**
 * @vistafam/auth-client - JWT Verification, RBAC, and Tenant Context
 * Shared authentication utilities for all VistaFam services
 */

import { verify, decode, JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';

// ── JWT Claims Schema ────────────────────────────────────────

export const VistaFamTokenSchema = z.object({
  iss: z.string(),
  sub: z.string().uuid(),
  aud: z.string(),
  exp: z.number(),
  iat: z.number(),
  jti: z.string(),
  tenantId: z.string(),
  tenantSlug: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    avatar: z.string().optional(),
  }),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  sessionId: z.string(),
  mfaVerified: z.boolean(),
});

export type VistaFamToken = z.infer<typeof VistaFamTokenSchema>;

// ── Verification ─────────────────────────────────────────────

export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  clockTolerance?: number; // seconds
}

export function verifyToken(
  token: string,
  publicKey: string,
  options?: VerifyOptions
): VistaFamToken {
  const decoded = verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: options?.issuer,
    audience: options?.audience,
    clockTolerance: options?.clockTolerance ?? 60,
  });

  return VistaFamTokenSchema.parse(decoded);
}

export function decodeToken(token: string): VistaFamToken | null {
  try {
    const decoded = decode(token, { complete: false }) as JwtPayload;
    return VistaFamTokenSchema.parse(decoded);
  } catch {
    return null;
  }
}

// ── RBAC Helpers ─────────────────────────────────────────────

export function hasPermission(
  token: VistaFamToken,
  requiredPermission: string
): boolean {
  // Admin wildcard grants everything
  if (token.permissions.includes('admin:*')) return true;

  // Exact match
  if (token.permissions.includes(requiredPermission)) return true;

  // Wildcard match (e.g., "teamsync:channel:*" matches "teamsync:channel:create")
  const [product, resource, action] = requiredPermission.split(':');
  return token.permissions.some((perm: string) => {
    const [p, r, a] = perm.split(':');
    return (
      p === product &&
      (r === '*' || r === resource) &&
      (a === '*' || a === action)
    );
  });
}

export function hasRole(token: VistaFamToken, role: string): boolean {
  return token.roles.includes(role);
}

export function hasAnyPermission(
  token: VistaFamToken,
  permissions: string[]
): boolean {
  return permissions.some((perm) => hasPermission(token, perm));
}

// ── Tenant Context ──────────────────────────────────────────

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  userName: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  mfaVerified: boolean;
}

export function extractTenantContext(token: VistaFamToken): TenantContext {
  return {
    tenantId: token.tenantId,
    tenantSlug: token.tenantSlug,
    userId: token.sub,
    userEmail: token.user.email,
    userName: token.user.name,
    roles: token.roles,
    permissions: token.permissions,
    sessionId: token.sessionId,
    mfaVerified: token.mfaVerified,
  };
}

// ── Service Token ────────────────────────────────────────────

export interface ServiceTokenPayload {
  sub: string; // "service:service-name"
  iss: string;
  aud: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export function createServiceTokenPayload(
  serviceName: string,
  permissions: string[]
): Omit<ServiceTokenPayload, 'iat' | 'exp'> {
  return {
    sub: `service:${serviceName}`,
    iss: 'vistafam-authsphere',
    aud: 'vistafam-internal',
    permissions,
  };
}

// ── Permission Constants ─────────────────────────────────────

export const Permissions = {
  // TeamSync
  TEAMSYNC_CHANNEL_CREATE: 'teamsync:channel:create',
  TEAMSYNC_CHANNEL_READ: 'teamsync:channel:read',
  TEAMSYNC_CHANNEL_DELETE: 'teamsync:channel:delete',
  TEAMSYNC_MESSAGE_SEND: 'teamsync:message:send',

  // FlowBoard
  FLOWBOARD_WORKFLOW_EXECUTE: 'flowboard:workflow:execute',
  FLOWBOARD_WORKFLOW_ADMIN: 'flowboard:workflow:admin',

  // VaultSpace
  VAULTSPACE_ASSET_UPLOAD: 'vaultspace:asset:upload',
  VAULTSPACE_ASSET_READ: 'vaultspace:asset:read',

  // InsightAI
  INSIGHTAI_AGENT_INTERACT: 'insightai:agent:interact',
  INSIGHTAI_MODEL_CONFIGURE: 'insightai:model:configure',

  // Admin
  ADMIN_WILDCARD: 'admin:*',
} as const;

// ── Fastify Decorator Helper ─────────────────────────────────

export interface AuthenticatedRequest {
  tenantContext: TenantContext;
  token: VistaFamToken;
}

export function requirePermission(permission: string) {
  return (request: { tenantContext?: TenantContext }, reply: { status: (code: number) => { send: (body: unknown) => void } }): void | Promise<void> => {
    if (!request.tenantContext) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const has = hasAnyPermission(
      { permissions: request.tenantContext.permissions, roles: request.tenantContext.roles } as VistaFamToken,
      [permission]
    );

    if (!has) {
      reply.status(403).send({ error: 'Forbidden' });
    }
  };
}

// ── Re-exports ───────────────────────────────────────────────

export { JwtPayload } from 'jsonwebtoken';
