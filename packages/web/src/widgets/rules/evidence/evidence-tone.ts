export type EvidenceTone = "trigger" | "action" | "warn";

interface EvidenceToneClasses {
  readonly text: string;
  readonly strong: string;
  readonly dot: string;
}

const EVIDENCE_TONE_CLASSES = {
  trigger: {
    text: "text-primary-hover",
    strong: "text-primary",
    dot: "bg-primary",
  },
  action: {
    text: "text-ink",
    strong: "text-ink",
    dot: "bg-ink-tertiary",
  },
  warn: {
    text: "text-warn",
    strong: "text-warn",
    dot: "bg-warn",
  },
} as const satisfies Readonly<Record<EvidenceTone, EvidenceToneClasses>>;

/** 증거 역할에 맞는 텍스트와 표시점 스타일을 반환한다. */
export function evidenceToneClasses(tone: EvidenceTone): EvidenceToneClasses {
  return EVIDENCE_TONE_CLASSES[tone];
}
