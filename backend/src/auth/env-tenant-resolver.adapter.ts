import { createHash } from 'node:crypto';
import { TenantResolver, type TenantIdentity } from './tenant-resolver.port.js';

/** Env-backed resolver: maps static gateway keys to tenants (PG_API_KEYS). */
export class EnvTenantResolver implements TenantResolver {
  constructor(private readonly gatewayKeys: Readonly<Record<string, string>>) {}

  resolve(apiKey: string): TenantIdentity | null {
    const tenantId = this.gatewayKeys[apiKey];
    if (!tenantId) return null;
    return {
      tenantId,
      apiKeyId: createHash('sha256').update(apiKey).digest('hex').slice(0, 12),
    };
  }
}
