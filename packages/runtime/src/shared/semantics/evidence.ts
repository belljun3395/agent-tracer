import type { EvidenceLevel } from "../events/kinds.type.js";

/** Creates an evidence descriptor with `evidenceLevel: "proven"` and the given reason string. */
export function provenEvidence(reason: string): { evidenceLevel: EvidenceLevel; evidenceReason: string } {
    return { evidenceLevel: "proven", evidenceReason: reason }
}
