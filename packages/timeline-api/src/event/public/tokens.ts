/**
 * DI tokens for cross-module access to the event module.
 */
export const TIMELINE_EVENT_READ = "TIMELINE_EVENT_READ";
export const TIMELINE_EVENT_WRITE = "TIMELINE_EVENT_WRITE";
export const TIMELINE_EVENT_PROJECTION = "TIMELINE_EVENT_PROJECTION";

/**
 * OpenSearch client token. The client instance is platform infrastructure
 * built from config in the composition root (api-gateway's database module);
 * this is the bridge token the event module's index adapter is injected with.
 */
export const OPENSEARCH_CLIENT = "OPENSEARCH_CLIENT";
