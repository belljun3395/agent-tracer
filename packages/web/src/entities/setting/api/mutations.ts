import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAppSetting, putAppSetting } from "~web/entities/setting/api/api-settings.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";

export function usePutAppSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => putAppSetting(key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.settings() });
    },
  });
}

export function useDeleteAppSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => deleteAppSetting(key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.settings() });
    },
  });
}
