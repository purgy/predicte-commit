import { ProviderError } from './errors';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

type ChatCompletionRequest = {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  stream?: boolean;
};

type FetchRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  dispatcher?: InstanceType<typeof ProxyAgent>;
};

const proxyAgents = new Map<string, InstanceType<typeof ProxyAgent>>();

let extensionProxyUrl = '';
let extensionNoProxy: string[] = [];

// Allow tests to override fetch implementation
let _fetch: typeof undiciFetch = undiciFetch;
export function _setFetchForTesting(fn: typeof undiciFetch): void {
  _fetch = fn;
}

function proxyLog(msg: string): void {
  try {
    // Lazy import to avoid vscode dependency in tests
    const { getOutputChannel } = require('../core/logging') as typeof import('../core/logging');
    getOutputChannel().appendLine(msg);
  } catch {
    console.log(msg);
  }
}

export function setProxyConfig(url: string, noProxy: string[]): void {
  extensionProxyUrl = url.trim();
  extensionNoProxy = noProxy;
  proxyLog(
    `[proxy] settings loaded: url="${extensionProxyUrl}", noProxy=${JSON.stringify(extensionNoProxy)}`,
  );
}

function withTimeout(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller;
}

function getEnvValue(name: string): string | undefined {
  const value = process.env[name] ?? process.env[name.toLowerCase()];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function matchesNoProxy(target: URL, entry: string): boolean {
  const normalized = entry.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === '*') {
    return true;
  }

  const [hostPatternRaw, port] = normalized.split(':', 2);
  const hostPattern = hostPatternRaw.replace(/^\./, '');
  const hostname = target.hostname.toLowerCase();

  if (port && target.port && target.port !== port) {
    return false;
  }

  return hostname === hostPattern || hostname.endsWith(`.${hostPattern}`);
}

function shouldBypassProxy(targetUrl: string, noProxyList: string[]): boolean {
  if (noProxyList.length === 0) {
    return false;
  }

  const target = new URL(targetUrl);
  return noProxyList.some((entry) => matchesNoProxy(target, entry));
}

function getProxyConfig(targetUrl: string): { proxyUrl?: string; envName?: string } {
  const target = new URL(targetUrl);

  // 1. Extension settings proxy (highest priority)
  if (extensionProxyUrl) {
    if (shouldBypassProxy(targetUrl, extensionNoProxy)) {
      proxyLog(`[proxy] bypass for ${target.hostname} (extension noProxy)`);
      return {};
    }
    proxyLog(`[proxy] using extension proxy "${extensionProxyUrl}" for ${target.hostname}`);
    return { proxyUrl: extensionProxyUrl, envName: 'predicteCommit.proxy.url' };
  }

  // 2. Environment variables (fallback)
  const envNoProxy = getEnvValue('NO_PROXY')?.split(/[,\s]+/) ?? [];
  if (shouldBypassProxy(targetUrl, envNoProxy)) {
    proxyLog(`[proxy] bypass for ${target.hostname} (env NO_PROXY)`);
    return {};
  }

  if (target.protocol === 'https:') {
    const httpsProxy = getEnvValue('HTTPS_PROXY');
    if (httpsProxy) {
      proxyLog(`[proxy] using env HTTPS_PROXY="${httpsProxy}" for ${target.hostname}`);
      return {
        proxyUrl: httpsProxy,
        envName: process.env.HTTPS_PROXY ? 'HTTPS_PROXY' : 'https_proxy',
      };
    }

    const httpProxy = getEnvValue('HTTP_PROXY');
    if (httpProxy) {
      proxyLog(`[proxy] using env HTTP_PROXY="${httpProxy}" for ${target.hostname}`);
      return { proxyUrl: httpProxy, envName: process.env.HTTP_PROXY ? 'HTTP_PROXY' : 'http_proxy' };
    }
  }

  if (target.protocol === 'http:') {
    const httpProxy = getEnvValue('HTTP_PROXY');
    if (httpProxy) {
      proxyLog(`[proxy] using env HTTP_PROXY="${httpProxy}" for ${target.hostname}`);
      return { proxyUrl: httpProxy, envName: process.env.HTTP_PROXY ? 'HTTP_PROXY' : 'http_proxy' };
    }
  }

  proxyLog(`[proxy] no proxy for ${target.hostname}`);
  return {};
}

function getProxyDispatcher(targetUrl: string): InstanceType<typeof ProxyAgent> | undefined {
  const { proxyUrl, envName } = getProxyConfig(targetUrl);
  if (!proxyUrl) {
    return undefined;
  }

  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    try {
      agent = new ProxyAgent(proxyUrl);
    } catch {
      throw new ProviderError(
        `Invalid proxy URL in ${envName ?? 'proxy environment variable'}: ${proxyUrl}`,
      );
    }
    proxyAgents.set(proxyUrl, agent);
  }

  return agent;
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

  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    const init: FetchRequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    };

    const dispatcher = getProxyDispatcher(url);
    if (dispatcher) {
      init.dispatcher = dispatcher;
    }

    res = await _fetch(url, init);
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
