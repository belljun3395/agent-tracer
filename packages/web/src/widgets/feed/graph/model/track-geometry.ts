export const LANE_HEIGHT = 60;
export const AXIS_HEIGHT = 28;
export const LANE_LABEL_WIDTH = 90;
export const TRACK_LEFT_PADDING = 16;

export function laneCenterY(laneIndex: number): number {
  return laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;
}

/** 거터와 패딩을 반영한 시간축 CSS 좌표를 반환한다. */
export function trackLeftCss(leftPercent: number): string {
  const trackStart = LANE_LABEL_WIDTH + TRACK_LEFT_PADDING;
  return `calc(${trackStart}px + (100% - ${trackStart}px) * ${leftPercent / 100})`;
}

/** 거터와 패딩을 반영한 시간축 픽셀 좌표를 반환한다. */
export function trackLeftPx(leftPercent: number, innerWidth: number): number {
  const trackStart = LANE_LABEL_WIDTH + TRACK_LEFT_PADDING;
  return trackStart + (innerWidth - trackStart) * (leftPercent / 100);
}
