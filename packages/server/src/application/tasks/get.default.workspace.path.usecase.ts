import { normalizeWorkspacePath } from "~domain/monitoring/index.js";
import type { GetDefaultWorkspacePathUseCaseIn, GetDefaultWorkspacePathUseCaseOut } from "./dto/get.default.workspace.path.usecase.dto.js";

export class GetDefaultWorkspacePathUseCase {
    execute(_input: GetDefaultWorkspacePathUseCaseIn): GetDefaultWorkspacePathUseCaseOut {
        const nodeProcess = (globalThis as { process?: { cwd: () => string } }).process;
        const cwd = nodeProcess ? nodeProcess.cwd() : "";
        return { workspacePath: normalizeWorkspacePath(cwd) };
    }
}
