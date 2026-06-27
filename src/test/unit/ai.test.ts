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
      provider: 'test-provider',
      useLocal: false,
      localProvider: 'ollama',
      models: [],
      ignoredFiles: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      openaiBaseUrl: '',
      openaiModel: '',
      localBaseUrl: '',
      localModel: '',
      debugLogging: false,
    };

    // Mock context (any, as our mock provider ignores it)
    const contextMock: any = {};

    const client = await selectProvider(contextMock, configMock);
    assert.strictEqual(client.id, 'test-provider');
  });

  test('selectProvider throws on unknown provider', async () => {
    const configMock: PredicteCommitConfig = {
      provider: 'unknown-provider',
      useLocal: false,
      localProvider: 'ollama',
      models: [],
      ignoredFiles: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      openaiBaseUrl: '',
      openaiModel: '',
      localBaseUrl: '',
      localModel: '',
      debugLogging: false,
    };

    await assert.rejects(async () => {
      await selectProvider({} as any, configMock);
    }, /not registered/);
  });

  test('selectProvider instantiates Mistral with context', async () => {
    const configMock: PredicteCommitConfig = {
      provider: 'mistral',
      useLocal: false,
      localProvider: 'ollama',
      models: [],
      ignoredFiles: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      openaiBaseUrl: '',
      openaiModel: '',
      localBaseUrl: '',
      localModel: '',
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
      provider: 'openai-compatible',
      useLocal: false,
      localProvider: 'ollama',
      models: [],
      ignoredFiles: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      openaiBaseUrl: 'https://example.com/v1',
      openaiModel: 'gpt-4o-mini',
      localBaseUrl: '',
      localModel: '',
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
