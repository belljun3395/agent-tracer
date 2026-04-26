import type { VerdictStatusPortDto } from "./dto/verdict.record.port.dto.js";

export interface VerdictStatusQueryPort {
    listVerdictStatusesForTask(taskId: string): Promise<readonly VerdictStatusPortDto[]>;
}
