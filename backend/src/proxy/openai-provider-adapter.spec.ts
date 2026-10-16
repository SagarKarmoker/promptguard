import { OpenAiProviderAdapter } from './openai-provider-adapter.js';

const adapter = new OpenAiProviderAdapter('https://upstream.test/', 'sk-upstream');

describe('OpenAiProviderAdapter', () => {
  it('joins the base URL with the /v1 segment and the proxied path', () => {
    const target = adapter.buildTarget({
      method: 'POST',
      path: 'chat/completions',
      incomingHeaders: {},
    });

    expect(target.url).toBe('https://upstream.test/v1/chat/completions');
  });

  it('swaps the inbound bearer token for the upstream one', () => {
    const target = adapter.buildTarget({
      method: 'POST',
      path: 'chat/completions',
      incomingHeaders: { authorization: 'Bearer pgk_gateway' },
    });

    expect(target.headers['authorization']).toBe('Bearer sk-upstream');
    expect(target.headers['authorization']).not.toContain('pgk_gateway');
  });

  it('forwards content-type/accept and defaults content-type to json', () => {
    const untouched = adapter.buildTarget({
      method: 'POST',
      path: 'chat/completions',
      incomingHeaders: { 'content-type': 'application/json; charset=utf-8', accept: 'text/event-stream' },
    });

    expect(untouched.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(untouched.headers['accept']).toBe('text/event-stream');

    const defaulted = adapter.buildTarget({
      method: 'POST',
      path: 'completions',
      incomingHeaders: {},
    });

    expect(defaulted.headers['content-type']).toBe('application/json');
  });
});
