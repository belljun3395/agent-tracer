/**
 * @module infrastructure/otel/otel-setup
 *
 * OpenTelemetry SDK 초기화.
 * PrometheusExporter를 preventServerStart 모드로 실행해
 * Express /metrics 라우트에서 직접 노출한다.
 */
import { metrics } from "@opentelemetry/api";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

export interface OtelSetupOptions {
  readonly serviceName?: string;
}

let _exporter: PrometheusExporter | null = null;
let _provider: MeterProvider | null = null;

export function startOtel(options: OtelSetupOptions = {}): void {
  if (_provider) return; // 이미 초기화됨

  const serviceName = options.serviceName ?? "monitor-server";

  _exporter = new PrometheusExporter({ preventServerStart: true });

  _provider = new MeterProvider({
    readers: [_exporter],
    resource: { attributes: { "service.name": serviceName } } as never,
  });

  metrics.setGlobalMeterProvider(_provider);
}

export function getMeter() {
  return metrics.getMeter("monitor-server");
}

export function getPrometheusExporter(): PrometheusExporter | null {
  return _exporter;
}

export async function shutdownOtel(): Promise<void> {
  if (_provider) {
    await _provider.shutdown();
    _provider = null;
    _exporter = null;
  }
}
