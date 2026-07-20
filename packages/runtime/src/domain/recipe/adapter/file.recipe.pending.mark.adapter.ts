import * as fs from "node:fs";
import {ensureAgentTracerHome, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import type {RecipePendingMarkStore} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipePendingMarkPort} from "~runtime/domain/recipe/port/recipe.pending.mark.port.js";
import {isRecord} from "~runtime/support/json.js";

/** 마크 파일을 홈 디렉터리에 원자적으로 쓰고, 읽기나 쓰기가 깨지면 마크가 없는 것으로 친다. */
export class FileRecipePendingMarkAdapter implements RecipePendingMarkPort {
    constructor(private readonly paths: AgentTracerPaths = resolveAgentTracerPaths()) {}

    read(): RecipePendingMarkStore {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(this.paths.recipePendingPath, "utf8"));
            return isRecord(parsed) ? (parsed as RecipePendingMarkStore) : {};
        } catch {
            return {};
        }
    }

    write(store: RecipePendingMarkStore): void {
        try {
            ensureAgentTracerHome(this.paths);
            const tmp = `${this.paths.recipePendingPath}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(store));
            fs.renameSync(tmp, this.paths.recipePendingPath);
        } catch {
            return;
        }
    }
}
