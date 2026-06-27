import * as vscode from 'vscode';
import { DEFAULT_SYSTEM_PROMPT } from '../ai/prompt';
import { PredicteCommitConfig } from './types';
import { DEFAULT_LOCAL_URL } from './constants';

export function getConfig(): PredicteCommitConfig {
  const cfg = vscode.workspace.getConfiguration('predicteCommit');
  const provider = cfg.get<string>('provider', 'mistral');
  const useLocal = cfg.get<boolean>('useLocal', false);
  const systemPrompt = cfg.get<string>('systemPrompt', DEFAULT_SYSTEM_PROMPT).trim();
  return {
    provider,
    models: cfg.get<string[]>('models', []),
    ignoredFiles: cfg.get<string[]>('ignoredFiles', ['*-lock.json', '*.svg', 'dist/**']),
    systemPrompt: systemPrompt.length > 0 ? systemPrompt : DEFAULT_SYSTEM_PROMPT,
    openaiBaseUrl: cfg.get<string>('openaiBaseUrl', ''),
    openaiModel: cfg.get<string>('openaiModel', ''),
    useLocal,
    localProvider: cfg.get<string>('localProvider', 'ollama'),
    localBaseUrl: cfg.get<string>('localBaseUrl', DEFAULT_LOCAL_URL),
    localModel: cfg.get<string>('localModel', ''),
    debugLogging: cfg.get<boolean>('debugLogging', false),
  };
}
