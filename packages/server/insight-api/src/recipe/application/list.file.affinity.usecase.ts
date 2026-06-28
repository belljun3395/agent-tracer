import { Injectable } from "@nestjs/common";
import { FileAffinityRepository } from "../repository/file.affinity.repository.js";

/** file-affinity 조회(파일별 intent / intent별 파일). */
@Injectable()
export class ListFileAffinityUseCase {
    constructor(private readonly fileAffinity: FileAffinityRepository) {}

    async listIntentsForFile(filePath: string) {
        const rows = await this.fileAffinity.listIntentsForFile(filePath);
        return {
            file: filePath,
            intents: rows.map((r) => ({
                intentLabel: r.intentLabel,
                role: r.role,
                openCount: r.openCount,
                lastSeenAt: r.lastSeenAt,
            })),
        };
    }

    async listByIntent(intent: string, limit: number) {
        const rows = await this.fileAffinity.listByIntent(intent, limit);
        return {
            intent,
            files: rows.map((r) => ({
                filePath: r.filePath,
                role: r.role,
                openCount: r.openCount,
                lastSeenAt: r.lastSeenAt,
            })),
        };
    }
}
