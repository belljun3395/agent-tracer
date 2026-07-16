/** 스냅샷을 탭별 카드와 표로 그리는 브라우저 스크립트 조각이다. */
export const CONTROL_PAGE_RENDER_SCRIPT = String.raw`
const STATUS_TONE = CFG.statusTone;
const STATUS_TEXT = CFG.statusText;
const IV_TAG = CFG.ivTag;
const IV_LABEL = CFG.ivLabel;

function renderStatus(s) {
  const d = s.daemon, t = s.transport;
  $("status-cards").innerHTML = [
    card("Pipeline", STATUS_TEXT[s.status], t.lastDeadReason ?? "", STATUS_TONE[s.status] === "err" ? "bad" : ""),
    card("Daemon version", d.version, "hook " + (d.hookVersion ?? "unknown"), s.versionSkew ? "bad" : ""),
    card("Last send", ago(t.lastSendAt), t.lastSendOutcome ?? ""),
    card("Backoff", t.backoffMs ? dur(t.backoffMs) : "none",
      t.retryStatusSince ? "stuck since " + clock(t.retryStatusSince) : "", t.backoffMs ? "warn" : ""),
    card("Uptime", dur(d.uptimeMs), "pid " + d.pid),
    card("Ingest endpoint", d.baseUrl, "from " + d.baseUrlOrigin, "", true),
    card("Identity", d.userId, "from " + d.userIdOrigin + " — " + d.configPath, "", true),
    card("Daemon entry", d.entryPath, "the path proves which build is actually running", "", true),
    card("Swallowed errors", d.swallowedErrors, d.swallowedErrors ? "silently ignored failures" : "",
      d.swallowedErrors ? "warn" : ""),
  ].join("");
}

function renderSpool(s) {
  const sp = s.spool;
  const pct = Math.min(100, (sp.backlogBytes / sp.capBytes) * 100);
  const tone = pct > 90 ? "err" : pct > 60 ? "warn" : "";
  $("spool-cards").innerHTML = [
    card("Pending segments", sp.segments, ""),
    card("Backlog", bytes(sp.backlogBytes), "cap " + bytes(sp.capBytes) + ", oldest dropped silently past it",
      tone === "err" ? "bad" : tone)
      .replace("</div></div>",
        '</div><div class="meter"><span class="' + tone + '" style="width:' + pct.toFixed(1) + '%"></span></div></div>'),
    card("Poison segment", sp.poisonSegment ?? "none",
      sp.poisonSegment ? "attempt " + sp.poisonAttempts + "/" + sp.poisonThreshold + ", isolating one bad batch" : "",
      sp.poisonSegment ? "warn" : ""),
  ].join("");
}

function renderDead(s) {
  const dl = s.deadLetter;
  const kinds = Object.entries(dl.byKind).sort((a, b) => b[1] - a[1]);
  $("dead-cards").innerHTML = [
    card("Dead-lettered", dl.count, bytes(dl.bytes), dl.count ? "bad" : ""),
    card("Distinct kinds", kinds.length, kinds.length > 1 ? "mixed vocabularies mean a version skew" : ""),
  ].join("");
  $("dead-kinds").innerHTML = table(["Kind", "Count", ""], kinds.map(([kind, count]) =>
    '<tr><td class="mono">' + esc(kind) + '</td><td class="num">' + count + "</td>"
    + '<td><button class="act" data-requeue="' + esc(kind) + '">Requeue</button></td></tr>'), "Nothing dead-lettered.");
  $("dead-rows").innerHTML = table(["Time", "Kind", "Task", "Id"], dl.entries.map((e) =>
    "<tr><td>" + esc(e.occurredAt) + '</td><td class="mono">' + esc(e.kind) + "</td>"
    + '<td class="mono muted">' + esc(e.taskId) + '</td><td class="mono muted">' + esc(e.id) + "</td></tr>"),
    "Nothing dead-lettered.");
}

function renderInterventions(s) {
  const iv = s.interventions;
  const hints = Object.entries(iv.hintTypeCounts).sort((a, b) => b[1] - a[1]);
  $("iv-cards").innerHTML = [
    card("Stops blocked", iv.totals.stop_blocked, "agent was forced to keep working", iv.totals.stop_blocked ? "warn" : ""),
    card("Hints injected", iv.totals.hints_injected, ""),
    card("Recipes injected", iv.totals.recipe_injected, ""),
    card("Context spent", bytes(iv.injectedBytes), "injection is not free, it eats the agent's context"),
    card("Detectors fired", hints.map(([t, c]) => t + " " + c).join(", ") || "none", "", "", true),
  ].join("");
  $("iv-rows").innerHTML = table(["Time", "Action", "Rule / detail", "Task"], iv.recent.map((e) =>
    "<tr><td>" + esc(clock(e.at)) + '</td><td><span class="tag ' + IV_TAG[e.kind] + '">' + esc(IV_LABEL[e.kind]) + "</span></td>"
    + "<td>" + (e.ruleName ? "<strong>" + esc(e.ruleName) + "</strong> " : "")
    + '<span class="muted">' + esc(e.detail ?? "") + "</span>"
    + (e.tool ? ' <span class="tag">' + esc(e.tool) + "</span>" : "")
    + (e.injectedBytes ? ' <span class="muted">(' + bytes(e.injectedBytes) + ")</span>" : "") + "</td>"
    + '<td class="mono muted">' + esc(e.taskId) + "</td></tr>"),
    "No interventions yet. The daemon has not touched the agent since it started.");
}

function renderRules(s) {
  $("rule-rows").innerHTML = table(
    ["Rule", "Scope / task", "Severity", "Trigger", "Evaluated", "Verified", "Contradicted", "Blocked", "Last fired"],
    s.rules.map((r) => {
      const pending = r.reviewState === CFG.reviewPending;
      const dead = r.cached && !pending && r.evaluated === 0 && r.blocked === 0;
      return "<tr><td>" + esc(r.ruleName)
        + (pending ? ' <span class="tag warn">awaiting approval, not enforced</span>' : "")
        + (dead ? ' <span class="tag">never fired</span>' : "")
        + (!r.cached ? ' <span class="tag deny">not in cache</span>' : "") + "</td>"
        + '<td class="mono muted">' + esc(r.taskId ? r.taskId : r.scope) + "</td>"
        + "<td>" + esc(r.severity) + '</td><td class="muted">' + esc(r.trigger) + "</td>"
        + '<td class="num">' + r.evaluated + '</td><td class="num">' + r.verified + "</td>"
        + '<td class="num">' + r.contradicted + "</td>"
        + '<td class="num">' + r.blocked + '</td><td class="muted">' + esc(ago(r.lastFiredAt)) + "</td></tr>";
    }), "No rules cached. The guardrail is enforcing nothing.");
}

function renderCaches(s) {
  const c = s.caches;
  const fresh = (f, label) => card(label, f.entries + " entries",
    "refreshed " + ago(f.lastRefreshAt) + " (every " + dur(f.intervalMs) + ")"
    + (f.lastFailureAt ? ", last failure " + ago(f.lastFailureAt) : ""),
    f.lastRefreshAt === null ? "bad" : "");
  $("cache-cards").innerHTML = [
    fresh(c.rules, "Rules cache"),
    fresh(c.recipes, "Recipes cache"),
    card("Bindings file", bytes(s.bindingsBytes), ""),
  ].join("");
}

function renderRing(s) {
  const r = s.ring;
  const kinds = Object.entries(r.byKind).sort((a, b) => b[1] - a[1]);
  $("ring-cards").innerHTML = [
    card("Tasks in ring", r.taskCount, "", r.taskCount === 0 ? "warn" : ""),
    card("Events held", r.eventCount, "max " + r.maxPerTask + " per task"),
    card("Hints and guardrail", r.eventCount === 0 ? "no evidence" : "have evidence",
      r.eventCount === 0 ? "an empty ring silently disables every rule" : "", r.eventCount === 0 ? "warn" : ""),
  ].join("");
  $("ring-rows").innerHTML = table(["Kind", "Events"], kinds.map(([kind, count]) =>
    '<tr><td class="mono">' + esc(kind) + '</td><td class="num">' + count + "</td></tr>"),
    "Ring is empty.");
  $("ring-tasks").innerHTML = table(["Task", "Events", "Last event"], r.tasks.map((t) =>
    '<tr><td class="mono">' + esc(t.taskId) + '</td><td class="num">' + t.events + "</td>"
    + '<td class="muted">' + esc(t.lastOccurredAt ?? "") + "</td></tr>"), "Ring is empty.");
}

function renderLifecycle(s) {
  const d = s.daemon;
  $("life-cards").innerHTML = [
    card("Idle shutdown in", dur(d.idleInMs), "the daemon exits when idle, hooks respawn it"),
    card("Active connections", d.activeConnections, ""),
    card("Socket", d.socketPath, "", "", true),
  ].join("");
}

function render(s) {
  snap = s;
  const pill = $("pill");
  pill.className = "pill live " + (STATUS_TONE[s.status] || "");
  pill.innerHTML = '<span class="dot"></span>' + esc(STATUS_TEXT[s.status]);
  $("skew").classList.toggle("hidden", !s.versionSkew);
  if (s.versionSkew) {
    $("skew-body").textContent = "Hooks run " + s.daemon.hookVersion + " but this daemon is "
      + s.daemon.version + ", running from " + s.daemon.entryPath
      + ". Events it ships may be rejected. Restart the daemon below.";
  }
  $("c-dead").textContent = s.deadLetter.count || "";
  $("c-iv").textContent = s.interventions.recent.length || "";
  renderStatus(s); renderSpool(s); renderDead(s); renderInterventions(s);
  renderRules(s); renderCaches(s); renderRing(s); renderLifecycle(s);
}
`;
