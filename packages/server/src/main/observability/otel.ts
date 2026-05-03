// OpenTelemetry SDK bootstrap.
//
// MUST be imported as the very first thing in `server.entry.ts` so that
// auto-instrumentations can patch `http`, `express`, etc. before they are
// required by Nest.
//
// Metrics are exposed on a separate HTTP listener (default port 9464)
// at `/metrics` for Prometheus to scrape. Service identification comes
// from env (OTEL_SERVICE_NAME, OTEL_RESOURCE_ATTRIBUTES) so we don't
// hard-code anything here.

import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const PROMETHEUS_PORT = parseInt(process.env.OTEL_PROMETHEUS_PORT ?? "9464", 10);
const PROMETHEUS_ENDPOINT = process.env.OTEL_PROMETHEUS_ENDPOINT ?? "/metrics";

const prometheusExporter = new PrometheusExporter({
    port: PROMETHEUS_PORT,
    endpoint: PROMETHEUS_ENDPOINT,
});

const sdk = new NodeSDK({
    metricReader: prometheusExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            // fs instrumentation is extremely chatty (every read/write becomes a span);
            // it dominates traces without adding signal for an HTTP service.
            "@opentelemetry/instrumentation-fs": { enabled: false },
            // dns/net are similar — drown the signal in noise.
            "@opentelemetry/instrumentation-dns": { enabled: false },
            "@opentelemetry/instrumentation-net": { enabled: false },
        }),
    ],
});

sdk.start();

const shutdown = (): void => {
    sdk.shutdown()
        .catch((err: unknown) => {
            process.stderr.write(`[otel] shutdown failed: ${String(err)}\n`);
        })
        .finally(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
