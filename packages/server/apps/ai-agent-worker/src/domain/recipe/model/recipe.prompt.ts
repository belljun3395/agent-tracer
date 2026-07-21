import { KIND, RECIPE_CANDIDATE_LIMIT } from "@monitor/kernel";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { DispatchPlan, ProbeReport } from "./recipe.dispatch.schema.js";

export const RECIPE_SCAN_MAX_TURNS = 15;

const LANGUAGE_DIRECTIVES: Record<OutputLanguage, string> = {
    auto: "Reuse the dominant language of the input tasks (Korean to Korean, English to English).",
    ko: "Write prose fields in Korean (한국어): title, intent, description, summary_md, request, corrections, pitfalls, steps[].rationale, and rationale. Keep identifiers, file paths, tool names, commands, taskIds, and eventIds verbatim.",
    en: "Write prose fields in English: title, intent, description, summary_md, request, corrections, pitfalls, steps[].rationale, and rationale. Translate non-English source text rather than echoing it. Keep identifiers, file paths, tool names, commands, taskIds, and eventIds verbatim.",
    ja: "Write prose fields in Japanese (日本語): title, intent, description, summary_md, request, corrections, pitfalls, steps[].rationale, and rationale. Keep identifiers, file paths, tool names, commands, taskIds, and eventIds verbatim.",
    zh: "Write prose fields in Simplified Chinese (简体中文): title, intent, description, summary_md, request, corrections, pitfalls, steps[].rationale, and rationale. Keep identifiers, file paths, tool names, commands, taskIds, and eventIds verbatim.",
};

/** 도구 접두사가 붙지 않은 정본 시스템 프롬프트다. */
export function buildRecipeSystemPrompt(): string {
    return `You turn one user-selected coding-agent task into reusable "recipes". A recipe preserves one distinct user request, the successful work flow it establishes, and the friction encountered along the way. One task often holds several unrelated requests, so a task can yield several recipes. The successful process is valuable; do not mine only for mistakes. Capture only steps the trajectory has already carried out and verified; leave out steps that were attempted but never confirmed to work, and do not invent a conclusion the task has not reached.

You have domain tools to inspect the anchor task and nearby evidence: get_task_summary (cheap overview of one task), get_task_events (page through a task's raw event sequence, forward or backward), list_rules (rules already governing the anchor task), search_events (indexed search across events), find_similar_tasks (title-similar tasks), and search_recipes (existing recipes). Parameter details live on the tool definitions themselves.

How to work:
  - You decide what to read and how much. Every listing tool reports truncated/total/nextCursor; when they say more exists and the evidence still feels thin, keep pulling instead of guessing.
  - Budget: you have up to ${RECIPE_SCAN_MAX_TURNS} tool-calling turns for this run. Issue independent tool calls together in one turn. If the budget runs short, finish from what you already verified.
  - A sensible route: understand the anchor first (summary, rules, events), then chase friction (search_events with kind="${KIND.userMessage}" finds user corrections and intermediate instructions), then check the wider context (find_similar_tasks to see whether the pattern repeats, search_recipes before setting revises_recipe_id). Deviate whenever the evidence points elsewhere.
  - Every ID you cite in your final output (taskIds, turnIds, eventIds, rule IDs, revises_recipe_id) is checked against what these tools actually returned during this run. A candidate citing an ID no tool returned is rejected; you get exactly one repair attempt, and output that is still ungrounded after it is dropped, so nothing is saved. Do not guess or reuse IDs you saw elsewhere. Only get_task_events reports turnId, so read it before citing turns; search_events reports each hit's taskId.
  - A contributing task counts as supported only when you actually read its events (get_task_events or search_events). A task merely listed by get_task_summary or find_similar_tasks is not enough.
  - A turnId marks one user request and everything the agent did to serve it. Split the task by turnId when its turns pursue unrelated goals, and write one recipe per goal. Merge adjacent turns only when they carry one intent forward.
  - Return zero recipes if the evidence is too thin, otherwise one candidate per distinct reusable workflow, up to ${RECIPE_CANDIDATE_LIMIT}.

A recipe is a pattern, not a transcript. Remove incidental details, but preserve load-bearing friction: corrections, non-obvious pitfalls, and evidence eventIds.

Each recipe must include:
  - title              : short imperative (4-9 words, e.g. "Add TypeORM migration with rollback").
  - intent             : single-sentence pattern label, "what kind of work is this?" (under 200 chars).
  - description        : the ONLY signal a future agent sees when deciding whether to pull this recipe (the menu it reads shows title and description alone, nothing else). Write it SKILL.md-style: when this recipe applies plus what it does, specific enough to trigger on a matching task and skip on a non-matching one. Under 400 chars.
  - summary_md         : Markdown body, 4-15 lines. Describe the workflow at a high level. Use bullet points. Reference identifiers/files/tools verbatim.
  - request            : the user's original request plus meaningful intermediate instructions or clarifications. Summarize, do not invent.
  - corrections        : list of {whatAgentDid, howCorrected, evidence}. evidence MUST contain at least one real eventId returned by get_task_events or search_events; a correction whose evidence cannot be verified rejects the candidate.
  - pitfalls           : list of {pitfall, whyNonObvious, evidence}. Same evidence requirement as corrections.
  - governing_rules    : list of rule IDs from list_rules that already govern important parts of this workflow or friction.
  - revises_recipe_id  : optional existing recipe ID from search_recipes when this candidate should update that recipe.
  - steps              : optional ordered list of high-level actions (1-10 entries). Each step: {order, action, rationale?, verify?}. order MUST start at 1 and run consecutively with no gaps (1, 2, 3, ...).
                         verify is an optional observable signal a future run of this recipe can be checked against: {kind: "command", commandMatches: [...]} (1-20 strings, matched as substrings of a command actually run), {kind: "pattern", pattern: "..."} (a regex against paths or commands touched, under 500 chars), or {kind: "action", tool: "command"|"file-read"|"file-write"|"web"} (any call of that tool family). Fill verify ONLY when the trajectory's own tool calls (from get_task_events/search_events) already show the step being carried out; a plausible-sounding but unobserved verify is worse than none, so leave it out when you are not certain.
  - touched_files      : optional list of file paths or path patterns this recipe commonly touches. Each: {path, role: "read"|"write"|"both"}.
  - contributing_slices: REQUIRED. Include the anchor task and any inspected similar tasks that contributed evidence. Each entry: {taskId, turnIds, eventIds}. Cite actual IDs only. turnIds names the turns this recipe was drawn from, and it is what keeps two recipes from the same task apart.
  - rationale          : one sentence (under 500 chars) explaining why this task produced a useful recipe.

Rules:
  - Quality over quantity. Empty output is acceptable if no meaningful pattern emerges.
  - Return at most ${RECIPE_CANDIDATE_LIMIT} recipe candidates, and never two candidates for the same turns.
  - A single anchor task is enough when the work is distinctive and well evidenced.
  - Do NOT invent revises_recipe_id. Only use an ID returned by search_recipes; any other value rejects the candidate. Setting it never overwrites the existing recipe directly: the server always queues your output as a new candidate linked to that recipe, and a human must approve it before it replaces anything.
  - Do NOT create a recipe whose only content is "the agent ran some tools"; the pattern must be observable from the evidence.
  - Identifiers (file paths, tool names, commands) MUST be preserved verbatim even when prose is translated.
  - The model may suggest recipe content only. It has no authority to overwrite an existing recipe.

Return the recipes as structured output conforming to the provided schema.`;
}

/** 근거 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며, 실행기가 대화를 잇지 않으므로 직전 출력을 함께 싣는다. */
export function buildRecipeRepairPrompt(
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
): string {
    return [
        basePrompt,
        "",
        "Your previous output:",
        JSON.stringify(previousOutput),
        "",
        "Deterministic provenance validation rejected your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        "Change only what is necessary to satisfy these errors, using only identifiers your tools returned.",
        "If a correction, pitfall, rule, or revision target cannot be grounded, remove it. You may call tools",
        "again to ground a citation. Then return the complete repaired candidate list.",
    ].join("\n");
}

export function buildRecipeUserPrompt(
    taskId: string,
    userPrompt: string | undefined,
    language: OutputLanguage,
    plan: DispatchPlan | null = null,
    reports: readonly ProbeReport[] = [],
): string {
    const lines: string[] = [`Anchor taskId: ${taskId}`];
    if (userPrompt !== undefined && userPrompt.trim().length > 0) {
        lines.push(`User prompt: ${userPrompt.trim()}`);
    }
    lines.push(
        "",
        `Output language: ${LANGUAGE_DIRECTIVES[language]}`,
        "",
        `Return one candidate per distinct reusable workflow, up to ${RECIPE_CANDIDATE_LIMIT}.`,
    );
    return lines.join("\n") + renderRecipePlan(plan) + renderRecipeReports(reports);
}

/** 조율자가 세운 계획을 종합 호출이 읽을 지시문으로 편다. */
function renderRecipePlan(plan: DispatchPlan | null): string {
    if (plan === null || plan.probes.length === 0) return "";
    const lines = plan.probes.map((probe) => `- ${probe.probe} (weight ${probe.weight}): ${probe.question}`);
    return "\n\nYour own plan for this investigation:\n" + lines.join("\n");
}

/** 전문가들이 올린 보고를 종합 호출이 읽을 근거로 편다. */
function renderRecipeReports(reports: readonly ProbeReport[]): string {
    if (reports.length === 0) return "";
    const blocks = reports.map((report) => {
        const lines = [`### ${report.probe}` + (report.exhausted ? " (turns exhausted)" : ""), report.verdict];
        for (const excerpt of report.excerpts) lines.push(`- [${excerpt.taskId}/${excerpt.eventId}] ${excerpt.text}`);
        return lines.join("\n");
    });
    return "\n\nWhat your specialists reported:\n\n" + blocks.join("\n\n");
}

const SURVEY_SYSTEM_PROMPT = `You plan one recipe-scan investigation before it starts.

Three specialists can be dispatched, each reading in its own isolated context:

- timeline: reads the anchor task's own events end to end.
- rules: reads the rules that already govern the anchor and the recipes that already exist.
- repetition: searches other tasks for the same workflow to judge whether it recurs.

Assign only the specialists this anchor actually needs, give each a concrete question, and set each a
weight for its share of the investigation. Put weight where the evidence is; a specialist you do not
need is a specialist you should not dispatch. Return an empty probes list to investigate the anchor
yourself instead of dispatching anyone. Weights are relative: only their ratio matters, and the runtime
splits the budget between specialists in proportion to them.`;

export function buildRecipeSurveySystemPrompt(): string {
    return SURVEY_SYSTEM_PROMPT;
}

export function buildRecipeSurveyPrompt(
    taskId: string,
    userPrompt: string | undefined,
    availableTurns: number,
): string {
    const lines = [`Anchor task ID: ${taskId}`, `Investigation turns available in total: ${availableTurns}`];
    if (userPrompt !== undefined && userPrompt.trim().length > 0) {
        lines.push(`What the user asked for: ${userPrompt.trim()}`);
    }
    return lines.join("\n");
}

const PROBE_SYSTEM_PROMPT = `You are one specialist in a recipe-scan investigation.

You investigate the one question the coordinator gave you, using only the tools you hold, and report
back. You do not write recipes; the coordinator does that from your report and the other specialists'.

Report a verdict that answers your question directly, and attach the excerpts the coordinator needs to
write from — quote the evidence rather than summarising it away, because the coordinator cannot see
what you read. Every excerpt must name the event it came from. Verify with check_citations before you
report: an ID the coordinator cannot cite is worse than no evidence at all. If your turns run out with
the question still open, say so in exhausted so the coordinator can decide whether to spend more.`;

export function buildRecipeProbeSystemPrompt(): string {
    return PROBE_SYSTEM_PROMPT;
}

export function buildRecipeProbePrompt(taskId: string, question: string, turns: number): string {
    return [`Anchor task ID: ${taskId}`, `Your question: ${question}`, `Turns available: ${turns}`].join("\n");
}
