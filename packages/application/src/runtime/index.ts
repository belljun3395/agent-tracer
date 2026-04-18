// The runtime registry, evidence helpers, and default-adapter registration
// all live in @monitor/domain (see packages/domain/src/runtime/). This
// application-layer barrel re-exports the domain surface so existing
// application-level callers (server, adapters, services) keep importing
// from `./runtime/index.js` without any code change.
export {
    registerRuntimeAdapter,
    registerRuntimeAdapterAlias,
    getRegisteredAdapters,
    getRegisteredAliases,
    getRuntimeCapabilities,
    getRuntimeEvidenceProfile,
    getKnownRuntimeCapabilities,
    listNativeSkillPaths,
    normalizeRuntimeAdapterId,
    getEventEvidence,
    getRuntimeCoverageSummary,
    listRuntimeCoverage,
    registerDefaultRuntimeAdapters,
    RUNTIME_ADAPTER_IDS,
} from "@monitor/domain";
export type { EventEvidence, RuntimeCoverageSummary } from "@monitor/domain";
