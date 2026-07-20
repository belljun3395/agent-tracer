import * as fs from "node:fs";
import * as path from "node:path";
import {ensureRecipePendingDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import type {RecipePendingMark} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";

/** 태스크마다 파일 하나이므로 세션 두 개가 같은 파일을 동시에 고치는 일이 없다. */
export class FileRecipePendingMarkAdapter implements RecipePendingMarkPort {
    constructor(private readonly paths: AgentTracerPaths = resolveAgentTracerPaths()) {}

    read(taskId: string): readonly RecipePendingMark[] {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath(taskId), "utf8"));
            return Array.isArray(parsed) ? (parsed as RecipePendingMark[]) : [];
        } catch {
            return [];
        }
    }

    write(taskId: string, marks: readonly RecipePendingMark[]): void {
        try {
            ensureRecipePendingDir(this.paths);
            const target = this.filePath(taskId);
            const tmp = `${target}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(marks));
            fs.renameSync(tmp, target);
        } catch {
            return;
        }
    }

    private filePath(taskId: string): string {
        return path.join(this.paths.recipePendingDir, `${encodeURIComponent(taskId)}.json`);
    }
}
