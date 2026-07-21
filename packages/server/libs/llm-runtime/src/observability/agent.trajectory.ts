import type { AiJobStepPayload } from "@monitor/kernel";

/** 한 번의 호출이 남긴 궤적이며 병합 후 이 이름이 각 스텝의 노드로 새겨진다. */
export interface AgentTrajectorySegment {
    readonly nodeName: string;
    readonly steps: readonly AiJobStepPayload[];
}

/** 여러 호출의 궤적을 seq 0부터 다시 매기며 이어 붙이고 각 스텝에 호출을 낸 노드 이름을 새긴다. */
export function mergeAgentTrajectory(segments: readonly AgentTrajectorySegment[]): readonly AiJobStepPayload[] {
    const merged: AiJobStepPayload[] = [];
    for (const segment of segments) {
        for (const step of segment.steps) {
            merged.push({ ...step, seq: merged.length, nodeName: segment.nodeName });
        }
    }
    return merged;
}
