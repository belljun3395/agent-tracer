import type { ElementType } from "react";
import type {
  GuidanceLocale,
  GuidanceMessage,
  GuidanceMessagePart,
} from "~web/shared/guidance.js";
import { getGuidanceMessageParts } from "~web/shared/guidance-message.js";

type GuidanceElement = Extract<ElementType, "div" | "p" | "span">;

interface GuidanceTextProps {
  readonly locale: GuidanceLocale;
  readonly message: GuidanceMessage;
  readonly as?: GuidanceElement;
  readonly className?: string;
}

export function GuidanceText({
  locale,
  message,
  as: Element = "span",
  className,
}: GuidanceTextProps) {
  return (
    <Element className={className} lang={locale}>
      {getGuidanceMessageParts(message).map(renderPart)}
    </Element>
  );
}

function renderPart(part: GuidanceMessagePart, index: number) {
  switch (part.kind) {
    case "text":
      return part.value;
    case "code":
      return <code key={index}>{part.value}</code>;
    case "strong":
      return <strong key={index}>{part.value}</strong>;
  }
}
