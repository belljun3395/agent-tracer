const GUIDANCE_MESSAGE_BRAND: unique symbol = Symbol("GuidanceMessage");

export type GuidanceMessagePart =
  | GuidanceTextPart
  | GuidanceCodePart
  | GuidanceStrongPart;

export interface GuidanceTextPart {
  readonly kind: "text";
  readonly value: string;
}

export interface GuidanceCodePart {
  readonly kind: "code";
  readonly value: string;
}

export interface GuidanceStrongPart {
  readonly kind: "strong";
  readonly value: string;
}

/** 카탈로그 메시지는 React 노드가 아니다. */
export interface GuidanceMessage {
  readonly [GUIDANCE_MESSAGE_BRAND]: true;
}

type GuidanceMessageInput = string | GuidanceMessagePart;

const PARTS_BY_MESSAGE = new WeakMap<
  GuidanceMessage,
  readonly GuidanceMessagePart[]
>();

export function createGuidanceMessage(
  ...inputs: readonly GuidanceMessageInput[]
): GuidanceMessage {
  if (inputs.length === 0) {
    throw new TypeError("A guidance message must contain at least one part.");
  }

  const parts = Object.freeze(inputs.map(toMessagePart));
  const message = Object.freeze({
    [GUIDANCE_MESSAGE_BRAND]: true as const,
  });
  PARTS_BY_MESSAGE.set(message, parts);
  return message;
}

export function guidanceText(value: string): GuidanceTextPart {
  return freezePart("text", value);
}

export function guidanceCode(value: string): GuidanceCodePart {
  return freezePart("code", value);
}

export function guidanceStrong(value: string): GuidanceStrongPart {
  return freezePart("strong", value);
}

export function isGuidanceMessage(value: unknown): value is GuidanceMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    PARTS_BY_MESSAGE.has(value as GuidanceMessage)
  );
}

/** @internal GuidanceText만 이 내부 표현을 읽는다. */
export function getGuidanceMessageParts(
  message: GuidanceMessage,
): readonly GuidanceMessagePart[] {
  const parts = PARTS_BY_MESSAGE.get(message);
  if (parts === undefined) {
    throw new TypeError("Invalid guidance message.");
  }
  return parts;
}

function toMessagePart(input: unknown): GuidanceMessagePart {
  if (typeof input === "string") {
    return guidanceText(input);
  }

  if (!isGuidanceMessagePart(input)) {
    throw new TypeError("Invalid guidance message part.");
  }

  return freezePart(input.kind, input.value);
}

function isGuidanceMessagePart(value: unknown): value is GuidanceMessagePart {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { readonly kind?: unknown; readonly value?: unknown };
  return (
    (candidate.kind === "text" ||
      candidate.kind === "code" ||
      candidate.kind === "strong") &&
    typeof candidate.value === "string"
  );
}

function freezePart<Kind extends GuidanceMessagePart["kind"]>(
  kind: Kind,
  value: string,
): Readonly<{ kind: Kind; value: string }> {
  if (value.length === 0) {
    throw new TypeError("Guidance message parts cannot be empty.");
  }
  return Object.freeze({ kind, value });
}
