import {CONTROL_PAGE_SCRIPT} from "~runtime/daemon/control/control.page.script.js";
import {CONTROL_PAGE_STYLE} from "~runtime/daemon/control/control.page.style.js";

const TABS: readonly (readonly [string, string])[] = [
    ["status", "Status"],
    ["interventions", "Interventions"],
    ["rules", "Rules"],
    ["spool", "Spool"],
    ["dead", "Dead-letter"],
    ["caches", "Caches"],
    ["ring", "Ring buffer"],
    ["lifecycle", "Lifecycle"],
];

const COUNTED = new Set(["dead", "interventions"]);

function renderTabs(): string {
    return TABS.map(([id, label], index) => {
        const counter = COUNTED.has(id) ? `<span class="count" id="c-${id === "interventions" ? "iv" : id}"></span>` : "";
        return `<button data-tab="${id}" role="tab" aria-selected="${index === 0}">${label}${counter}</button>`;
    }).join("");
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
      <div class="actions">
        <button class="act primary" id="a-flush">Flush now</button>
        <button class="act" id="a-backoff">Clear backoff</button>
      </div>
      <div class="grid" id="spool-cards"></div>`),
        section("dead", `
      <p class="note">Events the server refused for good. They are already lost from the dashboard.
        Requeue what a fix made shippable again, and only then purge the rest.</p>
      <div class="actions">
        <button class="act" id="a-requeue-all">Requeue all</button>
        <button class="act danger" id="a-purge">Purge all</button>
      </div>
      <div class="grid" id="dead-cards"></div>
      <h2 style="margin-top:18px">By kind</h2>
      <div id="dead-kinds"></div>
      <h2 style="margin-top:18px">Recent entries</h2>
      <div id="dead-rows"></div>`),
        section("caches", `
      <p class="note">The daemon pulls these from the server. If the pipeline stalls they freeze,
        and the daemon keeps enforcing rules the server no longer has.</p>
      <div class="actions"><button class="act" id="a-refresh">Refresh now</button></div>
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
      <div class="actions">
        <button class="act primary" id="a-restart">Restart daemon</button>
        <button class="act danger" id="a-stop">Stop daemon</button>
      </div>
      <div class="grid" id="life-cards"></div>`),
    ].join("");
}

/** 루프백에만 바인딩되는 제어 화면 HTML을 렌더링하며 제어 토큰을 문서에 심는다. */
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
<script data-token="${token}">${CONTROL_PAGE_SCRIPT}</script>
</body>
</html>`;
}
