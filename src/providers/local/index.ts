import { postChatCompletion } from '../../ai/http';
import type { GenerateRequest, GenerateResult, ProviderClient } from '../../ai/types';
import { registerProvider } from '../../ai/registry';

export class LocalProvider implements ProviderClient {
  constructor(
    readonly id: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const text = await postChatCompletion(url, undefined, {
      model: this.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    });
    return { text, providerId: this.id, model: this.model };
  }
}

const createLocalProvider = (id: string, defaultUrl: string) => {
  return async (_context: any, config: any) => {
    let baseUrl = config.local.baseUrl;
    if (!baseUrl) {
      baseUrl = defaultUrl;
    }

    const model = config.remote.models.length > 0 ? config.remote.models[0] : config.local.model;
    return new LocalProvider(id, baseUrl, model);
  };
};

registerProvider({
  id: 'ollama',
  label: 'Ollama',
  create: createLocalProvider('ollama', 'http://localhost:11434/v1'),
});

registerProvider({
  id: 'vllm',
  label: 'Local (vLLM)',
  create: createLocalProvider('vllm', 'http://localhost:8000/v1'),
});

registerProvider({
  id: 'lmstudio',
  label: 'Local (LM Studio)',
  create: createLocalProvider('lmstudio', 'http://localhost:1234/v1'),
});
