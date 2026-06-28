import * as assert from 'assert';
import { selectProvider } from '../../ai/selector';
import { registerProvider } from '../../ai/registry';
import { DEFAULT_SYSTEM_PROMPT } from '../../ai/prompt';
import { PredicteCommitConfig } from '../../core/types';
import { ProviderClient, GenerateRequest, GenerateResult } from '../../ai/types';

suite('AI Selector Test Suite', () => {
  test('selectProvider selects correct provider', async () => {
    // Mock Provider
    class MockProvider implements ProviderClient {
      id = 'test-provider';
      async generate(req: GenerateRequest): Promise<GenerateResult> {
        return { text: 'mock', providerId: this.id };
      }
    }

    registerProvider({
      id: 'test-provider',
      label: 'Test Provider',
      create: async () => new MockProvider(),
    });

    const configMock: PredicteCommitConfig = {
      mode: 'remote',
      remote: { provider: 'test-provider', models: [], baseUrl: '', model: '' },
      local: { provider: 'ollama', baseUrl: '', model: '' },
      proxy: { url: '', noProxy: [] },
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ignoredFiles: [],
      debugLogging: false,
    };

    const contextMock: any = {};

    const client = await selectProvider(contextMock, configMock);
    assert.strictEqual(client.id, 'test-provider');
  });

  test('selectProvider throws on unknown provider', async () => {
    const configMock: PredicteCommitConfig = {
      mode: 'remote',
      remote: { provider: 'unknown-provider', models: [], baseUrl: '', model: '' },
      local: { provider: 'ollama', baseUrl: '', model: '' },
      proxy: { url: '', noProxy: [] },
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ignoredFiles: [],
      debugLogging: false,
    };

    await assert.rejects(async () => {
      await selectProvider({} as any, configMock);
    }, /not registered/);
  });

  test('selectProvider instantiates Mistral with context', async () => {
    const configMock: PredicteCommitConfig = {
      mode: 'remote',
      remote: { provider: 'mistral', models: [], baseUrl: '', model: '' },
      local: { provider: 'ollama', baseUrl: '', model: '' },
      proxy: { url: '', noProxy: [] },
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ignoredFiles: [],
      debugLogging: false,
    };

    const contextMock: any = {
      secrets: {
        get: async () => 'fake-key',
      },
    };

    const client = await selectProvider(contextMock, configMock);
    assert.strictEqual(client.id, 'mistral');
  });

  test('selectProvider instantiates OpenAI compatible provider with context', async () => {
    const configMock: PredicteCommitConfig = {
      mode: 'remote',
      remote: {
        provider: 'openai-compatible',
        models: [],
        baseUrl: 'https://example.com/v1',
        model: 'gpt-4o-mini',
      },
      local: { provider: 'ollama', baseUrl: '', model: '' },
      proxy: { url: '', noProxy: [] },
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ignoredFiles: [],
      debugLogging: false,
    };

    const contextMock: any = {
      secrets: {
        get: async () => 'fake-key',
      },
    };

    const client = await selectProvider(contextMock, configMock);
    assert.strictEqual(client.id, 'openai-compatible');
  });
});
