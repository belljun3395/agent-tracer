import type { MonitoringPhase } from "../model/event.phase.model.js";

export const MONITORING_PHASES = [
    "planning",
    "exploration",
    "implementation",
    "verification",
    "coordination",
] as const satisfies readonly MonitoringPhase[];
