// event-semantic shared contract lives in @monitor/domain (already re-exported via core's
// index barrel). Interop additionally exposes the OpenInference outbound-adapter helpers
// that now live in @monitor/application.
export {
    buildOpenInferenceTaskExport,
    type OpenInferenceSpanKind,
    type OpenInferenceSpanRecord,
    type OpenInferenceTaskExport,
} from "@monitor/application";
