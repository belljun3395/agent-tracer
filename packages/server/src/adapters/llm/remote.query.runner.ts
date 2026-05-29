import { Injectable } from "@nestjs/common";
import { LlmJobBroker } from "./llm.job.broker.js";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "./query.runner.port.js";

/**
 * Dispatches a query to the local runtime daemon via {@link LlmJobBroker} and
 * awaits its result. The runtime runs the SDK next to the workspace (whose
 * files the cloud server cannot see). The Anthropic API key is stripped from
 * the env before the wire — the runtime supplies its own local key.
 *
 * Bound to QUERY_RUNNER when MONITOR_LLM_RUNNER=remote.
 */
@Injectable()
export class RemoteQueryRunner implements IQueryRunner {
    constructor(private readonly broker: LlmJobBroker) {}

    requiresLocalApiKey(): boolean {
        return false;
    }

    run(request: AgentQueryRequest): Promise<AgentQueryResult> {
        const { ANTHROPIC_API_KEY: _apiKey, ...env } = request.env;
        return this.broker.enqueue<AgentQueryResult>(request.label, { ...request, env });
    }
}
