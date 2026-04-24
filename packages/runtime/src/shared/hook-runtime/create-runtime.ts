import {createHookLogger, type HookLogger} from "./hook-log.js";
import {createMonitorTransport, type MonitorTransport} from "./transport.js";
import {
    resolveMonitorTransportConfig,
    resolveRuntimeLoggingConfig,
    type MonitorTransportConfig,
} from "~shared/config/env.js";

export interface HookRuntimeConfig {
    readonly logFile: string;
    readonly monitor?: MonitorTransportConfig;
}

export interface HookRuntime {
    readonly logger: HookLogger;
    readonly transport: MonitorTransport;
}

/**
 * Builds the per-runtime set of utilities (logger, transport) that every
 * hook handler needs. Each runtime (claude-code, codex) creates its own
 * HookRuntime with its own log file path and monitor transport config.
 *
 * This eliminates the duplication between `src/claude-code/hooks/lib/*`
 * and `src/codex/lib/*` while keeping each surface strongly typed.
 */
export function createHookRuntime(config: HookRuntimeConfig): HookRuntime {
    const logger = createHookLogger({
        logFile: config.logFile,
        enabled: resolveRuntimeLoggingConfig().enabled,
    });
    const transport = createMonitorTransport(config.monitor ?? resolveMonitorTransportConfig());
    return {logger, transport};
}
