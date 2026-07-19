const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** WCAG 상대휘도 공식으로 배경색과 검정·흰색 각각의 대비를 계산해 더 읽기 쉬운 전경색을 고른다. */
export function readableForeground(backgroundHex: string): "#000000" | "#ffffff" {
  const rgb = parseHexColor(backgroundHex);
  if (!rgb) return "#000000";

  const backgroundLuminance = relativeLuminance(rgb);
  const contrastWithBlack = contrastRatio(backgroundLuminance, 0);
  const contrastWithWhite = contrastRatio(backgroundLuminance, 1);

  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#ffffff";
}

function parseHexColor(hex: string): Rgb | null {
  const match = HEX_COLOR_PATTERN.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1] as string, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
