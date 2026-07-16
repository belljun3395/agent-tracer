import {CONTROL_PAGE_RENDER_SCRIPT} from "~runtime/daemon/control/control.page.render.js";

const HELPERS = String.raw`
const TOKEN = document.currentScript.dataset.token;
const POLL_MS = 2000;
let snap = null;

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function bytes(n) {
  if (!n) return "0 B";
  const u = ["B","KB","MB","GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + u[i];
}
function dur(ms) {
  if (ms === null || ms === undefined) return "never";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m " + (s % 60) + "s";
  const h = Math.floor(m / 60);
  return h + "h " + (m % 60) + "m";
}
const ago = (at) => at ? dur(snap.now - at) + " ago" : "never";
const clock = (at) => at ? new Date(at).toLocaleTimeString() : "";

function card(k, v, sub, tone, small) {
  return '<div class="card ' + (tone ?? "") + '"><div class="k">' + esc(k) + "</div>"
    + '<div class="v' + (small ? " sm" : "") + '">' + esc(v) + "</div>"
    + (sub ? '<div class="sub">' + esc(sub) + "</div>" : "") + "</div>";
}

function table(head, rows, emptyText) {
  if (rows.length === 0) return '<div class="empty">' + esc(emptyText) + "</div>";
  return '<div class="scroll"><table><thead><tr>' + head.map((h) => "<th>" + esc(h) + "</th>").join("")
    + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function call(path, body) {
  const res = await fetch("/api/v1/control/" + path, {
    method: "POST",
    headers: {"content-type": "application/json", "x-agent-tracer-resume-token": TOKEN},
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(json?.error?.message ?? "request failed");
    if (json?.errors) err.fieldErrors = json.errors;
    throw err;
  }
  return json.data;
}

async function act(path, body, message) {
  try {
    const data = await call(path, body);
    toast(message(data));
    await poll();
  } catch (err) {
    toast("Failed: " + err.message);
  }
}
`;

const SHELL = String.raw`
async function poll() {
  try {
    const res = await fetch("/api/v1/control/snapshot", {headers: {"x-agent-tracer-resume-token": TOKEN}});
    const json = await res.json();
    if (json.ok) render(json.data);
  } catch {
    const pill = $("pill");
    pill.className = "pill err";
    pill.innerHTML = '<span class="dot"></span>Daemon not responding';
  }
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("nav button");
  if (tab) {
    document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
    document.querySelectorAll("section").forEach((sec) => { sec.hidden = sec.id !== "s-" + tab.dataset.tab; });
    return;
  }
  const kind = event.target.dataset?.requeue;
  if (kind) {
    void act("dead-letter/requeue", {kinds: [kind]}, (d) => "Requeued " + d.moved + " event(s)");
    return;
  }
  const actionKey = event.target.dataset?.action;
  const spec = actionKey ? CFG.actions[actionKey] : null;
  if (spec) {
    if (spec.confirm && !confirm(spec.confirm)) return;
    void act(actionKey, {}, (d) => spec.toast + (d && typeof d.moved === "number" ? " " + d.moved + " event(s)" : ""));
  }
});

function settingsFieldIds() {
  return CFG.settingsFields.identity.concat(CFG.settingsFields.daemon);
}

function clearSettingsErrors() {
  settingsFieldIds().concat(["body"]).forEach((field) => {
    const el = $("err-" + field);
    if (el) el.textContent = "";
  });
}

function showSettingsErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const el = $("err-" + field) || $("err-body");
    if (el) el.textContent = message;
  });
}

function collectSettingsBody() {
  const daemon = {};
  CFG.settingsFields.daemon.forEach((field) => { daemon[field] = Number($("set-" + field).value); });
  return {userId: $("set-userId").value.trim(), baseUrl: $("set-baseUrl").value.trim(), daemon};
}

document.getElementById("settings-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearSettingsErrors();
  try {
    await call("config", collectSettingsBody());
    toast("Settings saved — restart the daemon to apply them");
    await poll();
  } catch (err) {
    if (err.fieldErrors) showSettingsErrors(err.fieldErrors);
    else $("err-body").textContent = err.message;
  }
});

void poll();
setInterval(() => void poll(), POLL_MS);
`;

/** 브라우저에서 도는 제어 화면 스크립트이며 번들러를 두지 않으려고 문자열로 싣는다. */
export const CONTROL_PAGE_SCRIPT = `${HELPERS}${CONTROL_PAGE_RENDER_SCRIPT}${SHELL}`;
