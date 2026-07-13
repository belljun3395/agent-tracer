import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchDaemonHealth } from "~web/entities/daemon/api/api-daemon-health.js";
import type { DaemonHealthResponse } from "~web/entities/daemon/model/daemon-health.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

// 데몬이 60초 간격으로 보고하므로 그보다 조금 더 넉넉히 재조회한다.
export function useDaemonHealthQuery(): UseQueryResult<DaemonHealthResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.daemonHealth(),
    queryFn: fetchDaemonHealth,
    refetchInterval: 30_000,
  });
}
