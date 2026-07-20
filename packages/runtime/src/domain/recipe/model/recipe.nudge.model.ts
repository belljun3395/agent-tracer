/** 레시피 존재 여부만 알리는 짧은 넛지이며 목록은 싣지 않고 search_recipes 호출로 관련성 판단을 넘긴다. */
export function formatRecipeNudge(count: number): string {
    if (count === 0) return "";
    return [
        "<agent-tracer-recipes>",
        `This workspace has ${count} saved recipes — workflows distilled from how past tasks here were `
            + "actually solved.",
        "If this request plausibly repeats one, call `search_recipes` with the task in your own words "
            + "before starting.",
        "</agent-tracer-recipes>",
    ].join("\n");
}
