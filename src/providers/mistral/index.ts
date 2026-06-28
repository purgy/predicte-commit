import { isAuthOrConfigStatus, isTransientStatus, ProviderError } from '../../ai/errors';
import { postChatCompletion } from '../../ai/http';
import type { GenerateRequest, GenerateResult, ProviderClient } from '../../ai/types';
import { registerProvider } from '../../ai/registry';

export const MISTRAL_API_KEY = 'predicteCommit.mistralApiKey';
const DEFAULT_MODELS = ['devstral-latest', 'devstral-small-latest'];

export class MistralProvider implements ProviderClient {
  readonly id = 'mistral';

  constructor(
    private readonly apiKey: string,
    private readonly models: string[],
  ) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const url = 'https://api.mistral.ai/v1/chat/completions';
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
        // Network/timeout: treat as transient and try next model.
        continue;
      }
    }

    throw lastErr ?? new ProviderError('All AI models failed.');
  }
}

registerProvider({
  id: 'mistral',
  label: 'Mistral AI',
  configKey: MISTRAL_API_KEY,
  create: async (context, config) => {
    const key = (await context.secrets.get(MISTRAL_API_KEY)) ?? '';
    const models = config.remote.models.length > 0 ? config.remote.models : DEFAULT_MODELS;
    return new MistralProvider(key, models);
  },
});
