/** 레시피 저장소가 있다는 사실만 알리는 고정 문구이며 목록과 개수를 싣지 않고 search_recipes 호출로 관련성 판단을 넘긴다. */
export function formatRecipeNudge(): string {
    return [
        "<agent-tracer-recipes>",
        "This workspace saves recipes — workflows distilled from how past tasks here were actually solved.",
        "If this request plausibly repeats one, call `search_recipes` with the task in your own words "
            + "before starting.",
        "</agent-tracer-recipes>",
    ].join("\n");
}
