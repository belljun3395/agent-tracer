import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    type ApplicationConfig,
    resolveMonitorHttpBaseUrl,
    resolveMonitorListenHost,
    resolveMonitorPort,
} from "./application-config.js";

/** DI key under which the loaded {@link ApplicationConfig} is registered. */
export const APP_CONFIG_NAMESPACE = "app";

/**
 * Typed accessor over `@nestjs/config`'s {@link ConfigService}. The raw config
 * is loaded once (YAML + env merge + zod validation) by {@link AppConfigModule}
 * and stored under the {@link APP_CONFIG_NAMESPACE} key; this service exposes it
 * with types plus the env-aware resolvers (absolute DB path, public base URL).
 */
@Injectable()
export class AppConfigService {
    constructor(private readonly config: ConfigService) {}

    get application(): ApplicationConfig {
        const app = this.config.get<ApplicationConfig>(APP_CONFIG_NAMESPACE);
        if (!app) {
            throw new Error("Application config was not loaded — is AppConfigModule imported?");
        }
        return app;
    }

    get profile(): ApplicationConfig["profile"] {
        return this.application.profile;
    }

    get monitor(): ApplicationConfig["monitor"] {
        return this.application.monitor;
    }

    get postgres(): ApplicationConfig["postgres"] {
        return this.application.postgres;
    }

    get opensearch(): ApplicationConfig["opensearch"] {
        return this.application.opensearch;
    }

    get redis(): ApplicationConfig["redis"] {
        return this.application.redis;
    }

    get web(): ApplicationConfig["web"] {
        return this.application.web;
    }

    get externalSetup(): ApplicationConfig["externalSetup"] {
        return this.application.externalSetup;
    }

    resolveListenHost(): string {
        return resolveMonitorListenHost(this.application);
    }

    resolvePort(): number {
        return resolveMonitorPort(this.application);
    }

    resolveHttpBaseUrl(): string {
        return resolveMonitorHttpBaseUrl(this.application);
    }
}
