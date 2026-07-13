import type { AgentBackendJobInput, JobStatusBase } from "~web/entities/job/model/job.js";

export interface TaskCleanupJobInput extends AgentBackendJobInput {
  readonly filters: Record<string, unknown>;
}

export interface TaskCleanupJobStatus extends JobStatusBase {
  readonly suggestionsCreated: number;
  readonly tasksScanned: number;
}
