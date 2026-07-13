export interface AppSettingItem {
  readonly key: string;
  readonly maskedValue: string;
  readonly hasValue: true;
  readonly updatedAt: string;
}

export interface AppSettingsListResponse {
  readonly settings: readonly AppSettingItem[];
}

export interface AppSettingUpsertResponse {
  readonly setting: AppSettingItem;
}
