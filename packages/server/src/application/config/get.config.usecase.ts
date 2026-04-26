import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";

export class GetConfigUseCase {
    constructor(private readonly deps: { readonly repo: IAppConfigRepository }) {}

    async execute(): Promise<Record<string, unknown>> {
        return this.deps.repo.getAll();
    }
}
