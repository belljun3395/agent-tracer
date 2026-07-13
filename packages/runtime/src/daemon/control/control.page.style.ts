/** 우산 패키지를 넘어 import할 수 없어 대시보드의 디자인 토큰을 값으로 복제한 제어 화면 CSS다. */
export const CONTROL_PAGE_STYLE = `
:root, :root[data-theme="dark"] {
  --canvas:#010102; --s1:#0f1011; --s2:#141516; --s3:#18191a; --s4:#1d1e1f;
  --hair:#23252a; --hair-strong:#34343a;
  --ink:#f7f8f8; --ink-muted:#d0d6e0; --ink-subtle:#8a8f98; --ink-tertiary:#62666d;
  --primary:#5e6ad2; --primary-hover:#828fff; --on-primary:#ffffff;
  --ok:#27a644; --warn:#caa14a; --err:#d35a4a;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --canvas:#ffffff; --s1:#f7f8f9; --s2:#eeeff2; --s3:#e4e7eb; --s4:#d8dce2;
    --hair:#d8dce2; --hair-strong:#b8bdc7;
    --ink:#0a0b0d; --ink-muted:#1f2127; --ink-subtle:#565b66; --ink-tertiary:#7d818a;
    --primary:#4a55b8; --primary-hover:#3d4998; --on-primary:#ffffff;
    --ok:#1e8a3d; --warn:#b08338; --err:#c14730;
    color-scheme: light;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--canvas); color: var(--ink);
  font-family: "Inter", -apple-system, system-ui, sans-serif;
  font-size: 13px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
code, .mono, td.mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 20px 24px 64px; }

header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; }
h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
h2 { font-size: 12px; font-weight: 600; color: var(--ink-muted); text-transform: uppercase;
     letter-spacing: 0.06em; margin-bottom: 10px; }
.spacer { flex: 1; }

.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
        border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid var(--hair-strong);
        color: var(--ink-muted); background: var(--s2); white-space: nowrap; }
.dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
.pill.ok { color: var(--ok); border-color: var(--ok); }
.pill.warn { color: var(--warn); border-color: var(--warn); }
.pill.err { color: var(--err); border-color: var(--err); }
.pill.live .dot { animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

.banner { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 8px;
          border: 1px solid var(--err); background: color-mix(in srgb, var(--err) 12%, var(--canvas));
          margin-bottom: 16px; }
.banner strong { color: var(--err); }
.banner p { color: var(--ink-muted); margin-top: 2px; }
.hidden { display: none !important; }

nav { display: flex; gap: 2px; border-bottom: 1px solid var(--hair); margin-bottom: 18px;
      overflow-x: auto; }
nav button { background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
             color: var(--ink-subtle); font: inherit; font-weight: 500; padding: 8px 12px;
             white-space: nowrap; transition: color 150ms; }
nav button:hover { color: var(--ink-muted); }
nav button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--primary); }
nav .count { color: var(--ink-tertiary); font-size: 11px; margin-left: 5px; }

section[hidden] { display: none; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(212px, 1fr)); }
.card { background: var(--s1); border: 1px solid var(--hair); border-radius: 8px; padding: 12px 14px; }
.card .k { color: var(--ink-subtle); font-size: 11px; text-transform: uppercase;
           letter-spacing: 0.05em; margin-bottom: 5px; }
.card .v { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; word-break: break-all; }
.card .v.sm { font-size: 12px; font-weight: 400; color: var(--ink-muted); }
.card .sub { color: var(--ink-tertiary); font-size: 11px; margin-top: 4px; word-break: break-all; }
.card.bad { border-color: var(--err); }
.card.warn { border-color: var(--warn); }

.meter { height: 4px; border-radius: 9999px; background: var(--s4); margin-top: 8px; overflow: hidden; }
.meter > span { display: block; height: 100%; background: var(--primary); }
.meter > span.warn { background: var(--warn); }
.meter > span.err { background: var(--err); }

table { width: 100%; border-collapse: collapse; font-size: 12px; }
thead th { text-align: left; color: var(--ink-subtle); font-weight: 500; font-size: 11px;
           text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px;
           border-bottom: 1px solid var(--hair); white-space: nowrap; }
tbody td { padding: 7px 10px; border-bottom: 1px solid var(--hair); vertical-align: top;
           color: var(--ink-muted); }
tbody tr:hover { background: var(--s1); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td .tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px;
          font-weight: 600; background: var(--s3); color: var(--ink-muted); }
.tag.deny { background: color-mix(in srgb, var(--err) 20%, var(--s3)); color: var(--err); }
.tag.block { background: color-mix(in srgb, var(--warn) 20%, var(--s3)); color: var(--warn); }
.tag.hint { background: color-mix(in srgb, var(--primary) 22%, var(--s3)); color: var(--primary-hover); }
.tag.recipe { background: color-mix(in srgb, var(--ok) 20%, var(--s3)); color: var(--ok); }
.tag.dead { background: var(--s3); color: var(--ink-tertiary); }
.muted { color: var(--ink-tertiary); }
.err-text { color: var(--err); }
.scroll { overflow-x: auto; border: 1px solid var(--hair); border-radius: 8px; background: var(--s1); }

.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
button.act { background: var(--s2); border: 1px solid var(--hair-strong); border-radius: 6px;
             color: var(--ink); cursor: pointer; font: inherit; font-weight: 500; padding: 6px 12px;
             transition: background 150ms, border-color 150ms; }
button.act:hover { background: var(--s3); border-color: var(--ink-tertiary); }
button.act.primary { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
button.act.primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
button.act.danger { color: var(--err); border-color: var(--err); background: transparent; }
button.act.danger:hover { background: color-mix(in srgb, var(--err) 14%, var(--canvas)); }
button.act:disabled { opacity: 0.45; cursor: not-allowed; }

.empty { color: var(--ink-tertiary); padding: 22px; text-align: center; }
.toast { position: fixed; right: 20px; bottom: 20px; background: var(--s3); color: var(--ink);
         border: 1px solid var(--hair-strong); border-radius: 8px; padding: 10px 14px;
         box-shadow: 0 4px 16px rgba(0,0,0,0.35); opacity: 0; transform: translateY(6px);
         transition: opacity 200ms, transform 200ms; pointer-events: none; }
.toast.show { opacity: 1; transform: none; }
.note { color: var(--ink-tertiary); font-size: 11px; margin-bottom: 12px; }
`;
