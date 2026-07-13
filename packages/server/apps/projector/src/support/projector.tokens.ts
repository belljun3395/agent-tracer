// 슬라이스 경계를 넘어 재사용하는 외부 자원 주입 토큰이며, inbound 계층도 안전하게 참조할 수 있도록 support가 소유한다.
export const NOTIFICATION_PRODUCER = Symbol("NOTIFICATION_PRODUCER");
export const DB_EVENT_CONSUMER = Symbol("DB_EVENT_CONSUMER");
export const SEARCH_EVENT_CONSUMER = Symbol("SEARCH_EVENT_CONSUMER");
export const OTLP_EVENT_CONSUMER = Symbol("OTLP_EVENT_CONSUMER");
export const OTLP_EXPORT_ENDPOINT = Symbol("OTLP_EXPORT_ENDPOINT");
