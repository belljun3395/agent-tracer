import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { metrics } from "@opentelemetry/api";
import type { Observable } from "rxjs";

const meter = metrics.getMeter("agent-tracer");

const ingestEventsCounter = meter.createCounter("ingest_events_total", {
    description: "Total events received via /ingest/v1/* endpoints, labeled by route and event kind.",
});

const ingestBatchSize = meter.createHistogram("ingest_batch_size", {
    description: "Number of events per ingest request body, labeled by route.",
    advice: { explicitBucketBoundaries: [1, 2, 5, 10, 20, 50, 100, 200, 500] },
});

interface IngestEventLike {
    readonly kind?: unknown;
}

interface IngestRequestLike {
    readonly route?: { readonly path?: string } | undefined;
    readonly path?: string | undefined;
    readonly body?: unknown;
}

function asRequest(value: unknown): IngestRequestLike {
    if (typeof value === "object" && value !== null) {
        return value as IngestRequestLike;
    }
    return {};
}

function resolveRoute(request: IngestRequestLike): string | undefined {
    const routePath = request.route?.path;
    if (typeof routePath === "string") return routePath;
    if (typeof request.path === "string") return request.path;
    return undefined;
}

function extractEvents(body: unknown): readonly IngestEventLike[] | undefined {
    if (typeof body !== "object" || body === null) return undefined;
    const events = (body as { readonly events?: unknown }).events;
    if (!Array.isArray(events)) return undefined;
    return events as readonly IngestEventLike[];
}

@Injectable()
export class IngestMetricsInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = asRequest(context.switchToHttp().getRequest<unknown>());
        const route = resolveRoute(request);

        if (route !== undefined && route.startsWith("/ingest/")) {
            const events = extractEvents(request.body);
            if (events !== undefined) {
                ingestBatchSize.record(events.length, { route });
                for (const event of events) {
                    const kind = typeof event.kind === "string" ? event.kind : "unknown";
                    ingestEventsCounter.add(1, { route, kind });
                }
            } else {
                // Single-shape ingest endpoints (sessions/ensure, sessions/end, conversation, …)
                ingestBatchSize.record(1, { route });
                ingestEventsCounter.add(1, { route, kind: "single" });
            }
        }

        return next.handle();
    }
}
