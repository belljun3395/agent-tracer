/**
 * Rule generation polling daemon.
 *
 * Periodically polls GET /api/v1/rules/generate/pending for jobs that the UI
 * enqueued but no runner has picked up yet. For each pending job, fetches the
 * task's workspacePath from /api/v1/tasks/:taskId, then calls runRuleGeneration
 * locally using the claude-agent-sdk binary.
 *
 * Intended to run alongside the dev server: npm run rule-gen:poll
 */
import { resolveMonitorBaseUrl } from "~shared/config/env.js";
import { monitorUserHeader } from "~shared/transport/transport.js";
import { runRuleGeneration } from "~shared/rule-generation/agent.js";

const POLL_INTERVAL_MS = 10_000;

interface PendingJob {
    jobId: string;
    taskId: string | null;
    createdAt: string;
}

interface PendingJobsResponse {
    jobs: PendingJob[];
}

interface ApiEnvelope<T> {
    ok: boolean;
    data?: T;
}

interface TaskData {
    task: { workspacePath?: string } | null;
}

async function fetchPendingJobs(baseUrl: string, headers: Record<string, string>): Promise<PendingJob[]> {
    const resp = await fetch(`${baseUrl}/api/v1/rules/generate/pending`, { headers });
    if (!resp.ok) return [];
    const body = await resp.json() as ApiEnvelope<PendingJobsResponse>;
    return body.data?.jobs ?? [];
}

async function fetchWorkspacePath(baseUrl: string, headers: Record<string, string>, taskId: string): Promise<string | null> {
    const resp = await fetch(`${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`, { headers });
    if (!resp.ok) return null;
    const body = await resp.json() as ApiEnvelope<TaskData>;
    return body.data?.task?.workspacePath ?? null;
}

const running = new Set<string>();

async function processPendingJobs(): Promise<void> {
    const baseUrl = resolveMonitorBaseUrl();
    const headers = { ...monitorUserHeader() };

    let jobs: PendingJob[];
    try {
        jobs = await fetchPendingJobs(baseUrl, headers);
    } catch {
        return;
    }

    for (const job of jobs) {
        if (!job.taskId) continue;
        if (running.has(job.jobId)) continue;

        const workspacePath = await fetchWorkspacePath(baseUrl, headers, job.taskId);
        if (!workspacePath) {
            console.warn(`[rule-gen] no workspacePath for task ${job.taskId}, skipping job ${job.jobId}`);
            continue;
        }

        running.add(job.jobId);
        console.log(`[rule-gen] starting job ${job.jobId} for task ${job.taskId}`);

        runRuleGeneration({ jobId: job.jobId, taskId: job.taskId, workspacePath })
            .then(() => {
                console.log(`[rule-gen] job ${job.jobId} completed`);
            })
            .catch((err: unknown) => {
                console.error(`[rule-gen] job ${job.jobId} threw:`, err);
            })
            .finally(() => {
                running.delete(job.jobId);
            });
    }
}

console.log(`[rule-gen] poller started (interval: ${POLL_INTERVAL_MS}ms)`);
await processPendingJobs();
setInterval(() => { processPendingJobs().catch(() => {}); }, POLL_INTERVAL_MS);
