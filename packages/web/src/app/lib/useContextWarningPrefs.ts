import { useMemo, useSyncExternalStore } from "react";
import {
    DEFAULT_CONTEXT_WARNING_PREFS,
    type ContextWarningPrefs,
    normalizeContextWarningThreshold,
    readContextWarningPrefs,
    subscribeContextWarningPrefs,
    writeContextWarningPrefs,
} from "./contextWarningPrefs.js";

export function useContextWarningPrefs(): {
    prefs: ContextWarningPrefs;
    setEnabled: (enabled: boolean) => void;
    setThresholdPct: (thresholdPct: number) => void;
} {
    const prefs = useSyncExternalStore(
        subscribeContextWarningPrefs,
        () => readContextWarningPrefs(),
        () => DEFAULT_CONTEXT_WARNING_PREFS,
    );

    const actions = useMemo(() => ({
        setEnabled: (enabled: boolean) => writeContextWarningPrefs({ ...readContextWarningPrefs(), enabled }),
        setThresholdPct: (thresholdPct: number) => writeContextWarningPrefs({
            ...readContextWarningPrefs(),
            thresholdPct: normalizeContextWarningThreshold(thresholdPct),
        }),
    }), []);

    return {
        prefs,
        setEnabled: actions.setEnabled,
        setThresholdPct: actions.setThresholdPct,
    };
}
