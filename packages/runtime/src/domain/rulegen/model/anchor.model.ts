/** 규칙의 근거가 된 사용자 입력을 프롬프트에 싣는 조각이다. */

export const ANCHOR_TAG = "anchor-input";

export function buildAnchorBlock(anchorText: string | undefined): string {
    if (anchorText === undefined || anchorText.trim() === "") return "";
    return `<${ANCHOR_TAG}>\n${anchorText.trim()}\n</${ANCHOR_TAG}>\n`;
}

export function buildAnchorDirective(anchorText: string | undefined): string {
    if (anchorText === undefined || anchorText.trim() === "") return "";
    return [
        `  - The <${ANCHOR_TAG}> is the ONE user request these rules verify. Derive every obligation from it alone.`,
        "  - Each rule is bound to that request: evaluation starts there and covers everything the agent does afterwards. Never ask the user to repeat themselves.",
        "  - One request can carry several obligations. Propose one rule per distinct obligation.",
        `  - If the <${ANCHOR_TAG}> carries no verifiable obligation, return an EMPTY rules array.`,
        "",
    ].join("\n");
}
