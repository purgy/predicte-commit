import * as assert from 'assert';
import { getConfig } from '../../core/config';
import { PredicteCommitConfig } from '../../core/types';
import { getEffectiveProviderId, isLocalMode } from '../../core/logic';
import { DEFAULT_SYSTEM_PROMPT } from '../../ai/prompt';

suite('Config Test Suite', () => {
  test('getEffectiveProviderId', () => {
    const baseCfg: PredicteCommitConfig = {
      mode: 'remote',
      remote: { provider: 'mistral', models: [], baseUrl: '', model: '' },
      local: { provider: 'ollama', baseUrl: '', model: '' },
      proxy: { url: '', noProxy: [] },
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ignoredFiles: [],
      debugLogging: false,
    };

    // Local mode -> returns local.provider
    assert.strictEqual(getEffectiveProviderId({ ...baseCfg, mode: 'local' }), 'ollama');
    assert.strictEqual(
      getEffectiveProviderId({
        ...baseCfg,
        mode: 'local',
        local: { ...baseCfg.local, provider: 'vllm' },
      }),
      'vllm',
    );

    // Remote mode -> returns remote.provider
    assert.strictEqual(getEffectiveProviderId(baseCfg), 'mistral');
    assert.strictEqual(
      getEffectiveProviderId({
        ...baseCfg,
        remote: { ...baseCfg.remote, provider: 'openai-compatible' },
      }),
      'openai-compatible',
    );
  });

  test('isLocalMode', () => {
    const cfg: PredicteCommitConfig = {
      mode: 'remote',
      remote: { provider: 'mistral', models: [], baseUrl: '', model: '' },
      local: { provider: 'ollama', baseUrl: '', model: '' },
      proxy: { url: '', noProxy: [] },
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ignoredFiles: [],
      debugLogging: false,
    };

    assert.strictEqual(isLocalMode(cfg), false);
    assert.strictEqual(isLocalMode({ ...cfg, mode: 'local' }), true);
  });

  test('getConfig defaults', () => {
    const cfg = getConfig();
    assert.strictEqual(cfg.mode, 'remote');
    assert.strictEqual(cfg.remote.provider, 'mistral');
    assert.deepStrictEqual(cfg.remote.models, []);
    assert.strictEqual(cfg.remote.baseUrl, '');
    assert.strictEqual(cfg.remote.model, '');
    assert.strictEqual(cfg.local.provider, 'ollama');
    assert.strictEqual(cfg.local.baseUrl, '');
    assert.strictEqual(cfg.local.model, '');
    assert.deepStrictEqual(cfg.ignoredFiles, ['*-lock.json', '*.svg', 'dist/**']);
    assert.strictEqual(cfg.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  });
});
