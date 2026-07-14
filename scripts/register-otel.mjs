// 프로세스 진입점보다 먼저 --import로 로드되며 OTEL_EXPORTER_OTLP_ENDPOINT가 없으면
// 로컬 개발에서는 완전히 no-op이고 오버레이 compose에서만 계측이 켜진다.
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint && process.env.OTEL_SDK_DISABLED !== "true") {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { PrometheusExporter } = await import("@opentelemetry/exporter-prometheus");

    const serviceName = process.env.OTEL_SERVICE_NAME ?? "unknown-service";
    const prometheusPort = Number(process.env.OTEL_PROMETHEUS_PORT ?? "9464");

    const sdk = new NodeSDK({
        serviceName,
        traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
        metricReader: new PrometheusExporter({ host: "0.0.0.0", port: prometheusPort }),
        instrumentations: [
            getNodeAutoInstrumentations({
                // 파일시스템/DNS/net 계측은 노이즈가 크고 파이프라인 관측에 무관하다.
                "@opentelemetry/instrumentation-fs": { enabled: false },
                "@opentelemetry/instrumentation-dns": { enabled: false },
                "@opentelemetry/instrumentation-net": { enabled: false },
            }),
        ],
    });

    sdk.start();
    process.stdout.write(`[otel] ${serviceName} instrumented (metrics :${prometheusPort}, traces -> ${otlpEndpoint})\n`);

    const shutdown = () => {
        sdk.shutdown().catch(() => {});
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
}
