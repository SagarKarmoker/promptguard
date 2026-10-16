/** Identity a gateway API key resolves to (PRD §5.2 multi-tenant model). */
export interface TenantIdentity {
  readonly tenantId: string;
  readonly apiKeyId: string;
}

/**
 * Port: resolves a raw bearer API key into a tenant identity.
 * Adapters can be backed by env vars (v1) or a database later.
 */
export interface TenantResolver {
  resolve(apiKey: string): TenantIdentity | null;
}

export const TENANT_RESOLVER = Symbol('TENANT_RESOLVER');
