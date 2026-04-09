export interface ApplicationConfig {
  readonly monitor: {
    readonly protocol: "http" | "https";
    readonly listenHost: string;
    readonly publicHost: string;
    readonly port: number;
    readonly databasePath: string;
  };
  readonly web: {
    readonly apiBaseUrl: string;
    readonly wsBaseUrl: string;
  };
  readonly externalSetup: {
    readonly monitorBaseUrl: string;
    readonly sourceRepo: string;
  };
}

export function loadApplicationConfig(options?: {
  env?: NodeJS.ProcessEnv;
}): ApplicationConfig;

export function resolveMonitorProtocol(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): "http" | "https";

export function resolveMonitorListenHost(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveMonitorPublicHost(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveMonitorPort(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): number;

export function resolveMonitorDatabasePath(
  config: ApplicationConfig,
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
): string;

export function resolveMonitorHttpBaseUrl(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveMonitorWsBaseUrl(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveWebApiBaseUrl(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveWebWsBaseUrl(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveExternalMonitorBaseUrl(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;

export function resolveExternalSourceRepo(
  config: ApplicationConfig,
  env?: NodeJS.ProcessEnv
): string;
