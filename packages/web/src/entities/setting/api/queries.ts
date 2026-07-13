import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchAppSettings } from "~web/entities/setting/api/api-settings.js";
import type { AppSettingsListResponse } from "~web/entities/setting/model/setting.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function useAppSettingsQuery(): UseQueryResult<AppSettingsListResponse> {
  return useQuery({
    queryKey: monitorQueryKeys.settings(),
    queryFn: fetchAppSettings,
  });
}
