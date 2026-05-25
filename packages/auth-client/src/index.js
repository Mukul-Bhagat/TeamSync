/**
 * @vistafam/auth-client - JWT Verification, RBAC, and Tenant Context
 * Shared authentication utilities for all VistaFam services
 */
import { verify, decode } from 'jsonwebtoken';
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
export function verifyToken(token, publicKey, options) {
    const decoded = verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: options?.issuer,
        audience: options?.audience,
        clockTolerance: options?.clockTolerance ?? 60,
    });
    return VistaFamTokenSchema.parse(decoded);
}
export function decodeToken(token) {
    try {
        const decoded = decode(token, { complete: false });
        return VistaFamTokenSchema.parse(decoded);
    }
    catch {
        return null;
    }
}
// ── RBAC Helpers ─────────────────────────────────────────────
export function hasPermission(token, requiredPermission) {
    // Admin wildcard grants everything
    if (token.permissions.includes('admin:*'))
        return true;
    // Exact match
    if (token.permissions.includes(requiredPermission))
        return true;
    // Wildcard match (e.g., "teamsync:channel:*" matches "teamsync:channel:create")
    const [product, resource, action] = requiredPermission.split(':');
    return token.permissions.some((perm) => {
        const [p, r, a] = perm.split(':');
        return (p === product &&
            (r === '*' || r === resource) &&
            (a === '*' || a === action));
    });
}
export function hasRole(token, role) {
    return token.roles.includes(role);
}
export function hasAnyPermission(token, permissions) {
    return permissions.some((perm) => hasPermission(token, perm));
}
export function extractTenantContext(token) {
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
export function createServiceTokenPayload(serviceName, permissions) {
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
};
export function requirePermission(permission) {
    return (request, reply) => {
        if (!request.tenantContext) {
            reply.status(401).send({ error: 'Unauthorized' });
            return;
        }
        const has = hasAnyPermission({ permissions: request.tenantContext.permissions, roles: request.tenantContext.roles }, [permission]);
        if (!has) {
            reply.status(403).send({ error: 'Forbidden' });
        }
    };
}
