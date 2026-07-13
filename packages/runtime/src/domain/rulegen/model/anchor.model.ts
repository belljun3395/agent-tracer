/** 규칙의 근거가 된 사용자 입력을 프롬프트에 싣는 조각이다. */

export const ANCHOR_TAG = "anchor-input";

export function buildAnchorBlock(anchorText: string | undefined): string {
    if (anchorText === undefined || anchorText.trim() === "") return "";
    return `<${ANCHOR_TAG}>\n${anchorText.trim()}\n</${ANCHOR_TAG}>\n`;
}

export function buildAnchorDirective(anchorText: string | undefined): string {
    if (anchorText === undefined || anchorText.trim() === "") return "";
    return [
        `  - An <${ANCHOR_TAG}> is given: it is the ONE user input these rules must verify. Derive obligations from it alone.`,
        "  - The rule is already bound to that input, so evaluation starts there and covers everything the agent does afterwards. Do NOT require the user to repeat themselves: omit trigger.phrases unless the rule should ALSO fire on future, unrelated turns.",
        "  - If the anchor input carries no verifiable obligation, return an EMPTY rules array.",
        "",
    ].join("\n");
}
