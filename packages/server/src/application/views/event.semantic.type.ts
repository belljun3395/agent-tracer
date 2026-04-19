import type { AllEventSubtypeKey, EventSubtypeGroup } from "~domain/index.js";

export interface EventSemanticView {
    readonly subtypeKey: AllEventSubtypeKey;
    readonly subtypeLabel: string;
    readonly subtypeGroup?: EventSubtypeGroup;
    readonly entityType?: string;
    readonly entityName?: string;
}
