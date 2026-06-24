import * as vscode from 'vscode';
import { getConfig } from './core/config';
import { getEffectiveProviderId } from './core/logic';
import { getGitExtension } from './modules/git/vscode';
import { getTargetRepository } from './modules/git/repo';
import { toRepoRelativePosixPath } from './utils/paths';
import { isIgnored } from './utils/ignore';
import { getStagedDiff } from './modules/git/diff';
import { capDiffsByFileAndTotal } from './utils/truncate';
import { ProviderError } from './ai/errors';
import { selectProvider } from './ai/selector';
import { logDebug } from './core/logging';
import { PROVIDER_REGISTRY, getProviderDefinition, ProviderDefinition } from './ai/registry';

export async function setApiKeyCommand(context: vscode.ExtensionContext): Promise<void> {
  const providersWithKeys = PROVIDER_REGISTRY.filter((p) => !!p.configKey);
  if (providersWithKeys.length === 0) {
    vscode.window.showInformationMessage('No providers require an API key.');
    return;
  }

  let diffProvider: ProviderDefinition | undefined;
  if (providersWithKeys.length === 1) {
    diffProvider = providersWithKeys[0];
  } else {
    const result = await vscode.window.showQuickPick(
      providersWithKeys.map((p) => ({ label: p.label, provider: p })),
      { placeHolder: 'Select provider to set API key for' },
    );
    if (!result) {
      return;
    }
    diffProvider = result.provider;
  }

  if (!diffProvider || !diffProvider.configKey) {
    return;
  }

  const key = await vscode.window.showInputBox({
    prompt: `Enter API key for ${diffProvider.label}`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'API key cannot be empty' : undefined),
  });

  if (!key) {
    return;
  }

  await context.secrets.store(diffProvider.configKey, key.trim());
  vscode.window.showInformationMessage(`API key for ${diffProvider.label} saved.`);
}

function showMissingKeyNotification(context: vscode.ExtensionContext, providerLabel: string): void {
  void vscode.window
    .showErrorMessage(
      `${providerLabel} API key is not set.`,
      `Set ${providerLabel} Key`,
      'Open Settings',
    )
    .then(async (choice) => {
      if (choice === `Set ${providerLabel} Key`) {
        await setApiKeyCommand(context);
      }
      if (choice === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'predicteCommit');
      }
    });
}

export async function maybePromptForApiKeyOnStartup(
  context: vscode.ExtensionContext,
): Promise<void> {
  const hasPrompted = context.globalState.get<boolean>('predicteCommit.didPromptForKey', false);
  if (hasPrompted) {
    return;
  }

  const cfg = getConfig();
  const providerId = getEffectiveProviderId(cfg);
  const def = getProviderDefinition(providerId);

  if (!def || !def.configKey) {
    return;
  }

  const key = await context.secrets.get(def.configKey);
  if (key && key.trim().length > 0) {
    return;
  }

  context.globalState.update('predicteCommit.didPromptForKey', true);
  showMissingKeyNotification(context, def.label);
}

function sanitizeCommitMessage(raw: string): string {
  let s = raw.trim();

  // Strip fenced code blocks if the model ignored the prompt.
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) {
      s = s.slice(firstNewline + 1);
    }
    const lastFence = s.lastIndexOf('```');
    if (lastFence !== -1) {
      s = s.slice(0, lastFence);
    }
  }

  return s.trim();
}

const CONVENTIONAL_HEADER_RE =
  /^(feat|fix|docs|chore|refactor|test|perf|build|ci|style|revert)(\([^)]+\))?:\s+.+/;

function normalizeCommitMessage(raw: string): string {
  const s = sanitizeCommitMessage(raw);
  const lines = s
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return s;
  }

  const subject = lines[0];
  const bodyBullets: string[] = [];

  for (const line of lines.slice(1)) {
    if (CONVENTIONAL_HEADER_RE.test(line)) {
      bodyBullets.push(`- ${line}`);
      continue;
    }
    if (line.startsWith('- ')) {
      bodyBullets.push(line);
      continue;
    }
    bodyBullets.push(`- ${line}`);
  }

  if (bodyBullets.length === 0) {
    return subject;
  }
  return `${subject}\n\n${bodyBullets.join('\n')}`;
}

export async function generateMessageCommand(
  context: vscode.ExtensionContext,
  contextArg?: unknown,
): Promise<void> {
  const cfg = getConfig();
  const gitExt = getGitExtension();
  const git = gitExt.getAPI(1);

  const repo = await getTargetRepository(git, contextArg);
  if (!repo) {
    vscode.window.showErrorMessage('No git repository found.');
    return;
  }

  const staged = repo.state.indexChanges;
  if (staged.length === 0) {
    vscode.window.showInformationMessage(`No staged changes found in ${repo.rootUri.fsPath}.`);
    return;
  }

  const repoRoot = repo.rootUri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.SourceControl,
      title: 'Generating commit message...',
      cancellable: false,
    },
    async () => {
      logDebug(cfg.debugLogging, [
        '[predicteCommit] generateMessage start',
        `repo: ${repo.rootUri.fsPath}`,
        `stagedFiles: ${staged.length}`,
      ]);

      const skipped: Array<{ file: string; pattern: string }> = [];
      const diffs: Array<{ header: string; diff: string }> = [];

      for (const change of staged) {
        const rel = toRepoRelativePosixPath(repoRoot, change.uri.fsPath);
        const matched = cfg.ignoredFiles.find((p) => isIgnored(rel, [p]));
        if (matched) {
          skipped.push({ file: rel, pattern: matched });
          continue;
        }
        const header = `# File: ${rel}`;
        const diff = await getStagedDiff(repo, change.uri);
        diffs.push({ header, diff });
      }

      if (diffs.length === 0) {
        vscode.window.showInformationMessage('All staged changes were ignored by settings.');
        return;
      }

      logDebug(cfg.debugLogging, [
        `includedFiles: ${diffs.length}`,
        `skippedFiles: ${skipped.length}`,
        ...skipped.map((s2) => `skipped: ${s2.file} (pattern: ${s2.pattern})`),
      ]);

      const boundedDiff = capDiffsByFileAndTotal(diffs);

      let provider;
      try {
        provider = await selectProvider(context, cfg);
      } catch (err) {
        vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
        return;
      }
      logDebug(cfg.debugLogging, [`provider: ${provider.id}`]);

      const userPrompt = `Diff:\n${boundedDiff}`;
      logDebug(cfg.debugLogging, [
        '--- systemPrompt ---',
        cfg.systemPrompt,
        '--- userPrompt (Diff) ---',
        userPrompt,
      ]);

      try {
        const result = await provider.generate({ systemPrompt: cfg.systemPrompt, userPrompt });
        logDebug(cfg.debugLogging, [
          `providerId: ${result.providerId}`,
          result.model ? `model: ${result.model}` : 'model: (unknown)',
        ]);
        repo.inputBox.value = normalizeCommitMessage(result.text);
      } catch (e) {
        const err =
          e instanceof ProviderError
            ? e
            : new ProviderError(e instanceof Error ? e.message : 'Provider error');
        if (err.status === 401 || err.status === 403) {
          const pid = getEffectiveProviderId(cfg);
          const def = getProviderDefinition(pid);
          showMissingKeyNotification(context, def ? def.label : pid);
          return;
        }
        vscode.window.showErrorMessage(err.message);
      }
    },
  );
}
