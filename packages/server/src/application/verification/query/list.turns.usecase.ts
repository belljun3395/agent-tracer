import type {
    ITurnQueryRepository,
    ListTurnsArgs,
    ListTurnsResult,
} from "~application/ports/repository/turn.query.repository.js";

export type { ListTurnsArgs } from "~application/ports/repository/turn.query.repository.js";

export class ListTurnsUseCase {
    constructor(private readonly deps: { readonly turnQueryRepo: ITurnQueryRepository }) {}

    async execute(args: ListTurnsArgs): Promise<ListTurnsResult> {
        return this.deps.turnQueryRepo.listTurns({
            limit: args.limit,
            ...(args.sessionId ? { sessionId: args.sessionId } : {}),
            ...(args.taskId ? { taskId: args.taskId } : {}),
            ...(args.verdict ? { verdict: args.verdict } : {}),
            ...(args.cursor ? { cursor: args.cursor } : {}),
        });
    }
}
