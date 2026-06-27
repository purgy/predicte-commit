import { ProviderError } from './errors';

type ChatCompletionRequest = {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  stream?: boolean;
};

function withTimeout(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller;
}

export async function postChatCompletion(
  url: string,
  apiKey: string | undefined,
  body: ChatCompletionRequest,
): Promise<string> {
  try {
    return await postChatCompletionOnce(url, apiKey, body);
  } catch (e) {
    if (
      e instanceof ProviderError &&
      e.status === 400 &&
      !body.stream &&
      e.message.includes('Stream must be set to true')
    ) {
      return postChatCompletionOnce(url, apiKey, { ...body, stream: true });
    }
    throw e;
  }
}

async function postChatCompletionOnce(
  url: string,
  apiKey: string | undefined,
  body: ChatCompletionRequest,
): Promise<string> {
  const controller = withTimeout(30_000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        throw new ProviderError(`Request timed out after 30s connecting to ${url}`);
      }
      const cause = (e as any).cause;
      if (cause?.code === 'ECONNREFUSED' || cause?.message?.includes('ECONNREFUSED')) {
        throw new ProviderError(`Connection refused to ${url}. Is the server running?`);
      }
      if (cause?.code === 'ENOTFOUND' || cause?.message?.includes('ENOTFOUND')) {
        throw new ProviderError(`Address not found: ${url}. Check your settings.`);
      }
      throw new ProviderError(`Network error: ${e.message}`);
    }
    throw new ProviderError('Network error');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderError(
      `API Error: ${res.status} ${res.statusText}${text ? ` - ${text.slice(0, 500)}` : ''}`,
      res.status,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    return parseEventStream(await res.text());
  }

  const data = (await res.json()) as unknown;
  return extractMessageContent(data);
}

function extractMessageContent(data: unknown): string {
  const obj = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = obj.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new ProviderError('API Error: Empty response content');
  }
  return content.trim();
}

function parseEventStream(streamText: string): string {
  const parts: string[] = [];

  for (const line of streamText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      continue;
    }

    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>;
      };
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        parts.push(delta);
        continue;
      }

      const message = parsed.choices?.[0]?.message?.content;
      if (typeof message === 'string' && message.length > 0) {
        parts.push(message);
      }
    } catch {
      continue;
    }
  }

  const content = parts.join('').trim();
  if (!content) {
    throw new ProviderError('API Error: Empty streamed response content');
  }
  return content;
}
