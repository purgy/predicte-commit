import * as vscode from 'vscode';
import { DEFAULT_SYSTEM_PROMPT } from '../ai/prompt';
import { PredicteCommitConfig, RemoteConfig, LocalConfig, ProxyConfig } from './types';

function readRemoteConfig(cfg: vscode.WorkspaceConfiguration): RemoteConfig {
  return {
    provider: cfg.get<string>('remote.provider', 'mistral'),
    models: cfg.get<string[]>('remote.models', []),
    baseUrl: cfg.get<string>('remote.baseUrl', ''),
    model: cfg.get<string>('remote.model', ''),
  };
}

function readLocalConfig(cfg: vscode.WorkspaceConfiguration): LocalConfig {
  return {
    provider: cfg.get<string>('local.provider', 'ollama'),
    baseUrl: cfg.get<string>('local.baseUrl', ''),
    model: cfg.get<string>('local.model', ''),
  };
}

function readProxyConfig(cfg: vscode.WorkspaceConfiguration): ProxyConfig {
  return {
    url: cfg.get<string>('proxy.url', ''),
    noProxy: cfg.get<string[]>('proxy.noProxy', []),
  };
}

export function getConfig(): PredicteCommitConfig {
  const cfg = vscode.workspace.getConfiguration('predicteCommit');
  const systemPrompt = cfg.get<string>('systemPrompt', DEFAULT_SYSTEM_PROMPT).trim();
  return {
    mode: cfg.get<string>('mode', 'remote') as PredicteCommitConfig['mode'],
    remote: readRemoteConfig(cfg),
    local: readLocalConfig(cfg),
    proxy: readProxyConfig(cfg),
    systemPrompt: systemPrompt.length > 0 ? systemPrompt : DEFAULT_SYSTEM_PROMPT,
    ignoredFiles: cfg.get<string[]>('ignoredFiles', ['*-lock.json', '*.svg', 'dist/**']),
    debugLogging: cfg.get<boolean>('debugLogging', false),
  };
}
