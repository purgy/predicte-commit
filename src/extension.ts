// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
  generateMessageCommand,
  maybePromptForApiKeyOnStartup,
  setApiKeyCommand,
  setOpenAiCompatibleApiKeyCommand,
  setOpenAiCompatibleBaseUrlCommand,
} from './commands';
import { getConfig } from './core/config';
import { setProxyConfig } from './ai/http';

function applyProxySettings(): void {
  const cfg = getConfig();
  setProxyConfig(cfg.proxy.url, cfg.proxy.noProxy);
}

export function activate(context: vscode.ExtensionContext) {
  applyProxySettings();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('predicteCommit.proxy')) {
        applyProxySettings();
      }
    }),
  );

  void maybePromptForApiKeyOnStartup(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('predicteCommit.setApiKey', () => setApiKeyCommand(context)),
    vscode.commands.registerCommand('predicteCommit.setOpenAiCompatibleApiKey', () =>
      setOpenAiCompatibleApiKeyCommand(context),
    ),
    vscode.commands.registerCommand('predicteCommit.setOpenAiCompatibleBaseUrl', () =>
      setOpenAiCompatibleBaseUrlCommand(),
    ),
    vscode.commands.registerCommand('predicteCommit.generateMessage', (arg?: unknown) =>
      generateMessageCommand(context, arg),
    ),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
