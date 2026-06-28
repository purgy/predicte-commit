import { isAuthOrConfigStatus, isTransientStatus, ProviderError } from '../../ai/errors';
import { postChatCompletion } from '../../ai/http';
import type { GenerateRequest, GenerateResult, ProviderClient } from '../../ai/types';
import { registerProvider } from '../../ai/registry';

export const OPENAI_COMPATIBLE_API_KEY = 'predicteCommit.openaiCompatibleApiKey';

export class OpenAiCompatibleProvider implements ProviderClient {
  readonly id = 'openai-compatible';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly models: string[],
  ) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    let lastErr: ProviderError | undefined;

    for (const model of this.models) {
      try {
        const text = await postChatCompletion(url, this.apiKey, {
          model,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userPrompt },
          ],
        });
        return { text, providerId: this.id, model };
      } catch (e) {
        const err =
          e instanceof ProviderError
            ? e
            : new ProviderError(e instanceof Error ? e.message : 'Provider error');
        lastErr = err;
        if (err.status !== undefined) {
          if (isAuthOrConfigStatus(err.status)) {
            throw err;
          }
          if (!isTransientStatus(err.status)) {
            throw err;
          }
          continue;
        }
        continue;
      }
    }

    throw lastErr ?? new ProviderError('All OpenAI compatible models failed.');
  }
}

registerProvider({
  id: 'openai-compatible',
  label: 'OpenAI Compatible',
  configKey: OPENAI_COMPATIBLE_API_KEY,
  create: async (context, config) => {
    const apiKey = (await context.secrets.get(OPENAI_COMPATIBLE_API_KEY)) ?? '';
    const baseUrl = config.remote.baseUrl.trim();
    const models =
      config.remote.models.length > 0 ? config.remote.models : [config.remote.model.trim()];

    if (!baseUrl) {
      throw new Error('OpenAI compatible API base URL is not configured.');
    }

    const filteredModels = models.map((model) => model.trim()).filter((model) => model.length > 0);
    if (filteredModels.length === 0) {
      throw new Error('OpenAI compatible model is not configured.');
    }

    return new OpenAiCompatibleProvider(apiKey, baseUrl, filteredModels);
  },
});
