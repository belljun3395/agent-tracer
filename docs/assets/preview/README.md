# Preview assets

The PNG files in this directory back the **Preview** section of the top-level
[`README.md`](../../../README.md). They are captured against a curated mock
run — no real agent traffic — so the visuals stay deterministic and free of
sensitive paths or PII.

## Regenerating the captures

The mock fixtures are produced by `scripts/seed-preview.mjs`, which posts a
short scripted run (user prompt → plan → explore → implement → rule check →
verify) into a running monitor server. Run from the repo root:

```bash
# 1. Boot the server against an isolated DB on a non-default port.
rm -f .monitor/preview.sqlite*
MONITOR_DATABASE_PATH=.monitor/preview.sqlite \
  MONITOR_PORT=3947 \
  npm run dev:server &

# 2. Seed the mock task once the server is healthy.
until curl -fs http://127.0.0.1:3947/health >/dev/null; do sleep 0.5; done
MONITOR_BASE_URL=http://127.0.0.1:3947 node scripts/seed-preview.mjs

# 3. Boot the dashboard pointed at the same server.
MONITOR_PORT=3947 npm run dev:web -- --port 5273 --host 127.0.0.1 &

# 4. Open http://127.0.0.1:5273/tasks/preview-task-checkout-tax and
#    capture the four screenshots referenced from the top-level README.
```

| File | Captured from |
|------|---------------|
| `dashboard-overview.png` | Default landing — task list + feed + inspector |
| `feed-graph.png` | "Graph" view button — swimlane layout closeup |
| `inspector.png` | Graph view with the verification node selected |
| `feed-walkthrough.png` | Full-page feed view (capture with full-page mode) |
| `demo.webm` | Recorded by `scripts/record-preview-demo.mjs` (Playwright) |
| `demo.gif` | `ffmpeg` conversion of `demo.webm` (used inline in README) |

## Re-recording the demo video

The static screenshots can be retaken with any tool, but the `.webm`
walkthrough is produced by a Playwright script. Playwright is intentionally
not in `package.json` (the recording is a one-off), so install it into a
scratch directory and point the script at it:

```bash
mkdir -p /tmp/agent-tracer-record && cd /tmp/agent-tracer-record \
  && npm init -y >/dev/null && npm install playwright \
  && npx playwright install chromium
cd -
PLAYWRIGHT_PATH=/tmp/agent-tracer-record/node_modules/playwright \
  node scripts/record-preview-demo.mjs
```

The script drives the dashboard through the same scripted mock task — feed
→ inspector → graph view → back to feed — and writes
`docs/assets/preview/demo.webm`.

GitHub's README HTML sanitizer drops `<video src="docs/...">` for relative
paths (only `user-attachments.githubusercontent.com` URLs survive), so the
README embeds a GIF rendition. Regenerate it after re-recording:

```bash
ffmpeg -y -i docs/assets/preview/demo.webm \
  -vf "fps=12,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  docs/assets/preview/demo.gif
```

## Why mock data

Real agent runs include local paths, prompts and tool output that are
hard to scrub for a public README. The seed script uses a synthetic
checkout-tax investigation that exercises every lane the dashboard
renders, so the captures stay representative without leaking anything
from a real session.
