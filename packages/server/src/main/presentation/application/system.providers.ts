import type { Provider } from "@nestjs/common";

// GetOverviewUseCase and GetDefaultWorkspacePathUseCase moved to the task module
// since both depend on task data. SystemApplicationModule now has nothing of its
// own — left in place for future cross-cutting system concerns.

export const SYSTEM_APPLICATION_PROVIDERS: Provider[] = [];
export const SYSTEM_APPLICATION_EXPORTS = [] as const;
