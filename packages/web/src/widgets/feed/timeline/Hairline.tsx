interface HairlineProps {
  /** 완성된 CSS 색 표현이며 마크마다 섞는 비율이 달라 호출부가 만든다. */
  readonly color: string;
}

/** 타임라인 마크의 라벨 옆을 채우는 점선이다. */
export function Hairline({ color }: HairlineProps) {
  return <span aria-hidden className="flex-1" style={{ borderTop: `1px dashed ${color}` }} />;
}
