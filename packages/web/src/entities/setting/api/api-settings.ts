import type { SettingDto } from "@monitor/kernel";
import type {
  AppSettingsListResponse,
  AppSettingUpsertResponse,
} from "~web/entities/setting/model/setting.js";
import { deleteRequest, getJson, patchPut } from "~web/shared/api/client/json-methods.js";

export async function fetchAppSettings(): Promise<AppSettingsListResponse> {
  const res = await getJson<{ readonly items: readonly SettingDto[] }>("/api/v1/settings");
  return { settings: res.items };
}

export function putAppSetting(
  key: string,
  value: string,
): Promise<AppSettingUpsertResponse> {
  return patchPut<AppSettingUpsertResponse>(
    `/api/v1/settings/${encodeURIComponent(key)}`,
    { value },
  );
}

export function deleteAppSetting(
  key: string,
): Promise<{ readonly deleted: boolean; readonly key: string }> {
  return deleteRequest<{ readonly deleted: boolean; readonly key: string }>(
    `/api/v1/settings/${encodeURIComponent(key)}`,
  );
}
