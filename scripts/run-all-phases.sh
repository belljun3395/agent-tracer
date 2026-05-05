#!/usr/bin/env bash
# Drive 5-phase × N-runs measurement sweep across all worktrees.
#
# Usage:
#   scripts/run-all-phases.sh [runs] [iterations]
#
# Defaults: 5 runs × 200 iterations × 5 phases = ~2.5 hours.
# Logs go to observability/results/sweep-<timestamp>/<phase>.log
# Progress markers written to observability/results/sweep-<timestamp>/PROGRESS.txt
# (used by the email-notifier loop).

set -euo pipefail

RUNS="${1:-5}"
ITERATIONS="${2:-200}"
WARMUP="${3:-20}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
SWEEP_DIR="${REPO_ROOT}/observability/results/sweep-${TS}"
PROGRESS_FILE="${SWEEP_DIR}/PROGRESS.txt"

mkdir -p "${SWEEP_DIR}"

PHASES=(
  "phase2-node-js"
  "phase2-bun-ts"
  "phase2-bun-js"
  "phase3-daemon-uds"
  "phase2-3-bun-js-daemon"
)

started_at_unix=$(date +%s)

cat >"${PROGRESS_FILE}" <<EOF
sweep timestamp: ${TS}
parameters: runs=${RUNS}, iterations=${ITERATIONS}, warmup=${WARMUP}
phases: ${#PHASES[@]} (${PHASES[*]})
started: $(date -Iseconds)
status: RUNNING
current_phase:
phases_completed: 0/${#PHASES[@]}
EOF

phase_idx=0
for phase in "${PHASES[@]}"; do
  phase_idx=$((phase_idx + 1))
  worktree="${REPO_ROOT}/.worktrees/${phase}"
  log_file="${SWEEP_DIR}/${phase}.log"

  # Update progress
  phase_started=$(date -Iseconds)
  sed -i '' "s|^current_phase:.*|current_phase: ${phase} (idx ${phase_idx}/${#PHASES[@]}, started ${phase_started})|" "${PROGRESS_FILE}"

  echo "" | tee -a "${log_file}"
  echo "######################################################" | tee -a "${log_file}"
  echo "# phase ${phase_idx}/${#PHASES[@]}: ${phase}" | tee -a "${log_file}"
  echo "# worktree: ${worktree}" | tee -a "${log_file}"
  echo "# started: ${phase_started}" | tee -a "${log_file}"
  echo "######################################################" | tee -a "${log_file}"

  cd "${worktree}"
  if node scripts/run-phase-bench-Nx.mjs \
       --runs "${RUNS}" \
       -- \
       --iterations "${ITERATIONS}" \
       --warmup "${WARMUP}" \
       2>&1 | tee -a "${log_file}"; then
    phase_finished=$(date -Iseconds)
    sed -i '' "s|^phases_completed:.*|phases_completed: ${phase_idx}/${#PHASES[@]}|" "${PROGRESS_FILE}"
    echo "[done] ${phase} at ${phase_finished}" | tee -a "${log_file}"
  else
    echo "[FAILED] ${phase}" | tee -a "${log_file}"
    sed -i '' "s|^status:.*|status: FAILED at phase ${phase}|" "${PROGRESS_FILE}"
    exit 1
  fi
done

finished_at=$(date -Iseconds)
elapsed=$(( $(date +%s) - started_at_unix ))
sed -i '' "s|^status:.*|status: COMPLETED|" "${PROGRESS_FILE}"
echo "" >> "${PROGRESS_FILE}"
echo "finished: ${finished_at}" >> "${PROGRESS_FILE}"
echo "elapsed_seconds: ${elapsed}" >> "${PROGRESS_FILE}"

echo ""
echo "All phases complete. Sweep dir: ${SWEEP_DIR}"
echo "Progress: ${PROGRESS_FILE}"
