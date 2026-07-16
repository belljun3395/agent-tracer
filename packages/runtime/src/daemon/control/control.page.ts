import {RULE_REVIEW_STATE} from "@monitor/kernel/rule/definition/rule.review.js";
import {CONTROL_ACTIONS, type ControlAction} from "~runtime/daemon/control/control.actions.js";
import type {PipelineStatus} from "~runtime/daemon/control/control.state.js";
import type {InterventionKind} from "~runtime/daemon/observation/intervention.log.js";
import {CONTROL_PAGE_SCRIPT} from "~runtime/daemon/control/control.page.script.js";
import {CONTROL_PAGE_STYLE} from "~runtime/daemon/control/control.page.style.js";

const STATUS_TONE = {
    ok: "ok",
    idle: "",
    retrying: "warn",
    rejecting: "err",
    unreachable: "err",
} satisfies Record<PipelineStatus, string>;

const STATUS_TEXT = {
    ok: "Shipping events",
    idle: "Idle, nothing queued",
    retrying: "Retrying, events held",
    rejecting: "Server rejecting events",
    unreachable: "Server unreachable",
} satisfies Record<PipelineStatus, string>;

const IV_TAG = {
    stop_blocked: "block",
    hints_injected: "hint",
    recipe_injected: "recipe",
} satisfies Record<InterventionKind, string>;

const IV_LABEL = {
    stop_blocked: "stop blocked",
    hints_injected: "hints injected",
    recipe_injected: "recipe injected",
} satisfies Record<InterventionKind, string>;

const ACTION_ENTRIES = Object.entries(CONTROL_ACTIONS) as readonly (readonly [string, ControlAction])[];

const TABS: readonly {readonly id: string; readonly label: string; readonly count?: string}[] = [
    {id: "status", label: "Status"},
    {id: "interventions", label: "Interventions", count: "iv"},
    {id: "rules", label: "Rules"},
    {id: "spool", label: "Spool"},
    {id: "dead", label: "Dead-letter", count: "dead"},
    {id: "caches", label: "Caches"},
    {id: "ring", label: "Ring buffer"},
    {id: "lifecycle", label: "Lifecycle"},
];

/** 서버가 페이지 스크립트에 심는 설정이다. */
function pageConfig(): unknown {
    const actions: Record<string, {toast: string; confirm?: string}> = {};
    for (const [key, action] of ACTION_ENTRIES) {
        actions[key] = {toast: action.toast, ...(action.confirm !== undefined ? {confirm: action.confirm} : {})};
    }
    return {
        statusTone: STATUS_TONE,
        statusText: STATUS_TEXT,
        ivTag: IV_TAG,
        ivLabel: IV_LABEL,
        reviewPending: RULE_REVIEW_STATE.pendingReview,
        actions,
    };
}

function renderTabs(): string {
    return TABS.map((tab, index) => {
        const counter = tab.count ? `<span class="count" id="c-${tab.count}"></span>` : "";
        return `<button data-tab="${tab.id}" role="tab" aria-selected="${index === 0}">${tab.label}${counter}</button>`;
    }).join("");
}

function actionButtons(tab: string): string {
    const buttons = ACTION_ENTRIES
        .filter(([, action]) => action.tab === tab)
        .map(([key, action]) =>
            `<button class="act${action.tone ? ` ${action.tone}` : ""}" data-action="${key}">${action.label}</button>`)
        .join("");
    return buttons ? `<div class="actions">${buttons}</div>` : "";
}

function section(id: string, body: string): string {
    return `<section id="s-${id}" role="tabpanel"${id === "status" ? "" : " hidden"}>${body}</section>`;
}

function renderSections(): string {
    return [
        section("status", `<div class="grid" id="status-cards"></div>`),
        section("interventions", `
      <p class="note">What the daemon did to the agent. It injects context and blocks turns that leave rules
        unfulfilled. Nothing else records this.</p>
      <div class="grid" id="iv-cards"></div>
      <h2 style="margin-top:18px">Recent interventions</h2>
      <div id="iv-rows"></div>`),
        section("rules", `
      <p class="note">Rules the daemon is enforcing right now, joined with how often each one actually fires.
        A rule that never fires is dead. A rule that fires every turn is noise.</p>
      <div id="rule-rows"></div>`),
        section("spool", `
      ${actionButtons("spool")}
      <div class="grid" id="spool-cards"></div>`),
        section("dead", `
      <p class="note">Events the server refused for good. They are already lost from the dashboard.
        Requeue what a fix made shippable again, and only then purge the rest.</p>
      ${actionButtons("dead")}
      <div class="grid" id="dead-cards"></div>
      <h2 style="margin-top:18px">By kind</h2>
      <div id="dead-kinds"></div>
      <h2 style="margin-top:18px">Recent entries</h2>
      <div id="dead-rows"></div>`),
        section("caches", `
      <p class="note">The daemon pulls these from the server. If the pipeline stalls they freeze,
        and the daemon keeps enforcing rules the server no longer has.</p>
      ${actionButtons("caches")}
      <div class="grid" id="cache-cards"></div>`),
        section("ring", `
      <p class="note">Events the daemon holds in memory. Hints and the guardrail judge from this and
        nothing else, so an empty ring disables both without a word.</p>
      <div class="grid" id="ring-cards"></div>
      <h2 style="margin-top:18px">By kind</h2>
      <div id="ring-rows"></div>
      <h2 style="margin-top:18px">By task</h2>
      <div id="ring-tasks"></div>`),
        section("lifecycle", `
      ${actionButtons("lifecycle")}
      <div class="grid" id="life-cards"></div>`),
    ].join("");
}

/** 루프백에만 바인딩되는 제어 화면 HTML을 렌더링하며 제어 토큰과 카탈로그 설정을 문서에 심는다. */
export function renderControlPage(token: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Tracer daemon</title>
<style>${CONTROL_PAGE_STYLE}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Daemon control</h1>
    <span class="pill" id="pill"><span class="dot"></span>Connecting</span>
    <span class="spacer"></span>
  </header>
  <div class="banner hidden" id="skew">
    <div><strong>Version skew</strong><p id="skew-body"></p></div>
  </div>
  <nav role="tablist">${renderTabs()}</nav>
  ${renderSections()}
</div>
<div class="toast" id="toast"></div>
<script data-token="${token}">const CFG=${JSON.stringify(pageConfig())};
${CONTROL_PAGE_SCRIPT}</script>
</body>
</html>`;
}
