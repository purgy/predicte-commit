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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
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
