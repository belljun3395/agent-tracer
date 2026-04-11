/**
 * Pins lifecycle and user-facing event kinds to non-overridable canonical lanes.
 */
export function getCanonicalLane(kind) {
    if (kind === "user.message" || kind === "task.start" || kind === "task.complete" || kind === "task.error") {
        return "user";
    }
    return undefined;
}
//# sourceMappingURL=classifier.helpers.js.map