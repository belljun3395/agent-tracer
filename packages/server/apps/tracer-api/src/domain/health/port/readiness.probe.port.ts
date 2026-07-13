export const READINESS_PROBE = Symbol("READINESS_PROBE");

/** tracer-api가 요청을 받기 전에 필요한 외부 의존성을 점검한다. */
export interface ReadinessProbe {
    pingDb(): Promise<void>;
    pingKafka(): Promise<void>;
}
