import type { ObservabilityOverviewSummary } from "../projection/observability.metrics.type.js";

export type GetObservabilityOverviewUseCaseIn = Record<string, never>;

export type ObservabilityOverviewUseCaseDto = ObservabilityOverviewSummary;

export interface GetObservabilityOverviewUseCaseOut {
    readonly observability: ObservabilityOverviewUseCaseDto;
}
