export const MIN_GRAPH_ZOOM = 1;
export const MAX_GRAPH_ZOOM = 16;
export const DEFAULT_GRAPH_ZOOM = 8;

export function clampGraphZoom(zoom: number): number {
  return Math.max(MIN_GRAPH_ZOOM, Math.min(zoom, MAX_GRAPH_ZOOM));
}
