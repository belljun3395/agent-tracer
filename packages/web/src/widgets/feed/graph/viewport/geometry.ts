import { trackLeftPx } from "~web/widgets/feed/graph/model/track-geometry.js";

export function centeredTrackScrollLeft(
  leftPercent: number,
  innerWidth: number,
  viewportWidth: number,
): number {
  const desired = trackLeftPx(leftPercent, innerWidth) - viewportWidth / 2;
  const max = Math.max(0, innerWidth - viewportWidth);
  return Math.max(0, Math.min(desired, max));
}
