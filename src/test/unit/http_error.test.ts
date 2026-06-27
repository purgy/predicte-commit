import * as assert from 'assert';
import { postChatCompletion } from '../../ai/http';
import { ProviderError } from '../../ai/errors';

suite('HTTP Error Handling', () => {
  test('ECONNREFUSED returns friendly message', async () => {
    const url = 'http://localhost:11111/v1/chat/completions'; // Port likely closed
    try {
      await postChatCompletion(url, undefined, { model: 'test', messages: [] });
      assert.fail('Should have thrown');
    } catch (e) {
      assert.ok(e instanceof ProviderError, `Expected ProviderError but got ${e}`);
      assert.ok(
        e.message.includes('Connection refused'),
        `Expected 'Connection refused' in '${e.message}'`,
      );
      assert.ok(e.message.includes(url), `Expected URL in error message '${e.message}'`);
    }
  });

  test('retries with stream=true when provider requires it', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ body?: string }> = [];

    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push({ body: typeof init?.body === 'string' ? init.body : undefined });
      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            error: {
              message: '{"detail":"Stream must be set to true"}',
            },
          }),
          {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        'data: {"choices":[{"delta":{"content":"feat: "}}]}\n\ndata: {"choices":[{"delta":{"content":"add support"}}]}\n\ndata: [DONE]\n',
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/event-stream' },
        },
      );
    }) as typeof fetch;

    try {
      const result = await postChatCompletion('https://example.com/v1/chat/completions', 'key', {
        model: 'test-model',
        messages: [],
      });

      assert.strictEqual(result, 'feat: add support');
      assert.strictEqual(requests.length, 2);
      assert.strictEqual(JSON.parse(requests[0].body ?? '{}').stream, undefined);
      assert.strictEqual(JSON.parse(requests[1].body ?? '{}').stream, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('uses proxy dispatcher when HTTPS_PROXY is set', async () => {
    const originalFetch = globalThis.fetch;
    const originalHttpProxy = process.env.HTTP_PROXY;
    const originalHttpsProxy = process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';

    let dispatcherSeen: unknown;
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      dispatcherSeen = (init as RequestInit & { dispatcher?: unknown })?.dispatcher;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'feat: proxy support' } }],
        }),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const result = await postChatCompletion('https://example.com/v1/chat/completions', 'key', {
        model: 'test-model',
        messages: [],
      });

      assert.strictEqual(result, 'feat: proxy support');
      assert.ok(dispatcherSeen, 'Expected a proxy dispatcher to be passed to fetch');
    } finally {
      globalThis.fetch = originalFetch;
      if (originalHttpProxy === undefined) {
        delete process.env.HTTP_PROXY;
      } else {
        process.env.HTTP_PROXY = originalHttpProxy;
      }
      if (originalHttpsProxy === undefined) {
        delete process.env.HTTPS_PROXY;
      } else {
        process.env.HTTPS_PROXY = originalHttpsProxy;
      }
    }
  });

  test('skips proxy dispatcher when NO_PROXY matches target host', async () => {
    const originalFetch = globalThis.fetch;
    const originalHttpsProxy = process.env.HTTPS_PROXY;
    const originalNoProxy = process.env.NO_PROXY;
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';
    process.env.NO_PROXY = 'example.com';

    let dispatcherSeen: unknown;
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      dispatcherSeen = (init as RequestInit & { dispatcher?: unknown })?.dispatcher;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'feat: bypass proxy' } }],
        }),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const result = await postChatCompletion('https://example.com/v1/chat/completions', 'key', {
        model: 'test-model',
        messages: [],
      });

      assert.strictEqual(result, 'feat: bypass proxy');
      assert.strictEqual(dispatcherSeen, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalHttpsProxy === undefined) {
        delete process.env.HTTPS_PROXY;
      } else {
        process.env.HTTPS_PROXY = originalHttpsProxy;
      }
      if (originalNoProxy === undefined) {
        delete process.env.NO_PROXY;
      } else {
        process.env.NO_PROXY = originalNoProxy;
      }
    }
  });
});
