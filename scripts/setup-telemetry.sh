#!/usr/bin/env bash
# setup-telemetry.sh
# Appends the four environment variables required for Agent Tracer token
# telemetry to the user's shell profile (~/.zshrc or ~/.bashrc).
# Safe to run multiple times — already-present variables are skipped.

set -euo pipefail

# ── Resolve target shell profile ────────────────────────────────────────────

if [ -f "$HOME/.zshrc" ]; then
    PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    PROFILE="$HOME/.bashrc"
else
    PROFILE="$HOME/.zshrc"
    touch "$PROFILE"
fi

# ── Read MONITOR_PORT / MONITOR_BASE_URL from the environment ────────────────

if [ -n "${MONITOR_BASE_URL:-}" ]; then
    ENDPOINT="${MONITOR_BASE_URL%/}"
else
    PORT="${MONITOR_PORT:-3847}"
    HOST="${MONITOR_PUBLIC_HOST:-127.0.0.1}"
    ENDPOINT="http://${HOST}:${PORT}"
fi

# ── Helper: append only if the variable is not already exported ──────────────

append_if_missing() {
    local var="$1"
    local value="$2"
    if grep -qE "^[[:space:]]*export[[:space:]]+${var}=" "$PROFILE" 2>/dev/null; then
        echo "  skip  $var (already present in $PROFILE)"
    else
        printf '\nexport %s=%s' "$var" "$value" >> "$PROFILE"
        echo "  added $var=$value"
    fi
}

# ── Apply ────────────────────────────────────────────────────────────────────

echo ""
echo "Agent Tracer — token telemetry setup"
echo "Profile : $PROFILE"
echo "Endpoint: $ENDPOINT"
echo ""

# Insert a section header only when none of our vars are present yet
if ! grep -qE "Agent Tracer.*token telemetry" "$PROFILE" 2>/dev/null; then
    printf '\n# Agent Tracer — token telemetry' >> "$PROFILE"
fi

append_if_missing "CLAUDE_CODE_ENABLE_TELEMETRY" "1"
append_if_missing "OTEL_LOGS_EXPORTER"           "otlp"
append_if_missing "OTEL_EXPORTER_OTLP_PROTOCOL"  "http/json"
append_if_missing "OTEL_EXPORTER_OTLP_ENDPOINT"  "$ENDPOINT"

echo ""
echo "Done. Reload your shell profile and restart Claude Code:"
echo ""
echo "  source $PROFILE"
echo ""
echo "To verify, send any prompt in Claude Code then check:"
echo "  curl -s http://${ENDPOINT#http://}/v1/logs -X POST \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"resourceLogs\":[]}' | python3 -m json.tool"
echo ""
