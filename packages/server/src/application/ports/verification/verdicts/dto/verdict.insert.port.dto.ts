import type { VerdictStatusPortDto } from "./verdict.record.port.dto.js";

export interface VerdictInsertPortDto {
    readonly id: string;
    readonly turnId: string;
    readonly ruleId: string;
    readonly status: VerdictStatusPortDto;
    readonly detail: {
        readonly matchedPhrase?: string;
        readonly expectedPattern?: string;
        readonly actualToolCalls?: readonly string[];
        readonly matchedToolCalls?: readonly string[];
    };
    readonly evaluatedAt: string;
}
