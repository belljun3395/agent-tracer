import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";

export class UpdateConfigUseCase {
    constructor(private readonly deps: { readonly repo: IAppConfigRepository }) {}

    async execute(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
        if (Object.keys(updates).length === 0) {
            throw new Error("UpdateConfigUseCase: at least one key required");
        }
        await this.deps.repo.setMany(updates);
        return this.deps.repo.getAll();
    }
}
