export type RemoteConfig = {
  provider: string;
  models: string[];
  baseUrl: string;
  model: string;
};

export type LocalConfig = {
  provider: string;
  baseUrl: string;
  model: string;
};

export type ProxyConfig = {
  url: string;
  noProxy: string[];
};

export type PredicteCommitConfig = {
  mode: 'remote' | 'local';
  remote: RemoteConfig;
  local: LocalConfig;
  proxy: ProxyConfig;
  systemPrompt: string;
  ignoredFiles: string[];
  debugLogging: boolean;
};
