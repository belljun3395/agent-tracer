import { Injectable } from "@nestjs/common";
import type { IRuleGenerationDispatcher } from "../../public/generation/rule.generation.dispatcher.port.js";

// Plugin executes rule generation locally after session end; no server-side dispatch needed.
@Injectable()
export class NoopRuleGenerationDispatcher implements IRuleGenerationDispatcher {
    async dispatch(_input: { jobId: string; taskId: string }): Promise<void> {}
}
