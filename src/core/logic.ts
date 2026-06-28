import { PredicteCommitConfig } from './types';

export function isLocalMode(cfg: PredicteCommitConfig): boolean {
  return cfg.mode === 'local';
}

export function getEffectiveProviderId(cfg: PredicteCommitConfig): string {
  if (cfg.mode === 'local') {
    return cfg.local.provider;
  }
  return cfg.remote.provider;
}
