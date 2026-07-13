import type { ReactNode } from "react";
import { isDaemonHealthStale } from "~web/entities/daemon/model/daemon-health.js";
import { formatBytes } from "~web/shared/lib/formatting/format-bytes.js";
import { formatAbsoluteHHmmss, formatRelativeShort } from "~web/shared/lib/formatting/time.js";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";
import { useDaemonHealthQuery } from "~web/entities/daemon/api/queries.js";
import { Card, Pill, Tooltip } from "~web/shared/ui/index.js";

/** 로컬 데몬이 보고하는 자기 건강 스냅샷(스풀 적체·dead-letter·삼킨 오류·버전· 마지막 보고 시각)을 보여준다. */
/** 로컬 수집 데몬의 연결·스풀·재시작 상태를 표시한다. */
export function DaemonHealthSection() {
  const { data } = useDaemonHealthQuery();
  const nowMs = useNowMs(15_000);
  const snapshot = data?.snapshot ?? null;

  return (
    <Card surface="canvas" className="py-5 px-6">
      <h2 className="text-[15px] font-semibold mb-1">Collector health</h2>
      {!snapshot ? (
        <p className="text-ink-muted text-sm">No health report received yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-1">
          <Row label="Spool backlog" value={formatBytes(snapshot.spoolBacklogBytes)} />
          <Row
            label="Dead-letter"
            value={
              snapshot.lastDeadReasons.length > 0 ? (
                <Tooltip content={snapshot.lastDeadReasons.join("; ")} side="left">
                  <span>{snapshot.deadLetterCount}</span>
                </Tooltip>
              ) : (
                `${snapshot.deadLetterCount}`
              )
            }
          />
          <Row label="Swallowed errors" value={`${snapshot.swallowedErrors}`} />
          <Row label="Daemon version" value={snapshot.daemonVersion} />
          <Row
            label="Last reported"
            value={
              <span className="flex items-center gap-2">
                <Tooltip content={formatAbsoluteHHmmss(snapshot.reportedAt)} side="left">
                  <span>{formatRelativeShort(snapshot.reportedAt, nowMs)} ago</span>
                </Tooltip>
                {isDaemonHealthStale(snapshot.reportedAt, nowMs) ? (
                  <Pill tone="warn" dot>stale</Pill>
                ) : (
                  <Pill tone="ok" dot>live</Pill>
                )}
              </span>
            }
          />
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span className="text-ink-tertiary">{label}</span>
      <span className="text-ink font-mono">{value}</span>
    </div>
  );
}
