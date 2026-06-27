import type * as vscode from 'vscode';
import type { PredicteCommitConfig } from '../core/types';
import { getEffectiveProviderId } from '../core/logic';
import type { ProviderClient } from './types';
import { getProviderDefinition } from './registry';

// Import providers to ensure they register themselves
import '../providers/mistral';
import '../providers/openaiCompatible';
import '../providers/local';

export async function selectProvider(
  context: vscode.ExtensionContext,
  cfg: PredicteCommitConfig,
): Promise<ProviderClient> {
  const providerId = getEffectiveProviderId(cfg);
  const def = getProviderDefinition(providerId);
  if (!def) {
    // Fallback or error
    throw new Error(`Provider '${providerId}' is not registered.`);
  }

  return def.create(context, cfg);
}
