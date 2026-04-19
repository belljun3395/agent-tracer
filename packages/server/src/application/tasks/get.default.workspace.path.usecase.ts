import { normalizeWorkspacePath } from "~domain/index.js";

export class GetDefaultWorkspacePathUseCase {
    execute(): string {
        const nodeProcess = (globalThis as { process?: { cwd: () => string } }).process;
        const cwd = nodeProcess ? nodeProcess.cwd() : "";
        return normalizeWorkspacePath(cwd);
    }
}
