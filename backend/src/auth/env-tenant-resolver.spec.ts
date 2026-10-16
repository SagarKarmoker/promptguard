import { EnvTenantResolver } from './env-tenant-resolver.adapter.js';

function makeResolver(extraKeys: Record<string, string> = {}): EnvTenantResolver {
  return new EnvTenantResolver({
    'pgk_alpha': 'tenant-alpha',
    ...extraKeys,
  });
}

describe('EnvTenantResolver', () => {
  it('resolves a known key to a tenant identity', () => {
    const identity = makeResolver().resolve('pgk_alpha');

    expect(identity).toEqual({ tenantId: 'tenant-alpha', apiKeyId: expect.any(String) });
  });

  it('returns null for unknown or empty keys', () => {
    const resolver = makeResolver();

    expect(resolver.resolve('pgk_unknown')).toBeNull();
    expect(resolver.resolve('')).toBeNull();
  });

  it('derives a stable apiKeyId from the key, never exposing the raw key', () => {
    const resolver = makeResolver();
    const identity = resolver.resolve('pgk_alpha');

    expect(identity?.apiKeyId).not.toContain('pgk_alpha');
    expect(resolver.resolve('pgk_alpha')?.apiKeyId).toBe(identity?.apiKeyId);
  });
});
