import { lazy, Suspense, type ReactNode } from "react";
import { Tabs, TabsContent } from "~web/shared/ui/index.js";
import {
  useInspectorTab,
  useSetInspectorTab,
  type InspectorTab as InspectorTabKey,
} from "~web/shared/store/index.js";
import { InspectorTabs } from "~web/widgets/inspector/InspectorTabs.js";
import { InspectTab } from "~web/widgets/inspector/tabs/inspect/InspectTab.js";

// Trace는 별도 청크로 분리해, 초기 렌더에서 inspector 오른쪽 레일이 span-tree 빌더까지 끌고 오지 않는다.
const TraceTab = lazy(() =>
  import("~web/widgets/inspector/tabs/trace/TraceTab.js").then((m) => ({ default: m.TraceTab })),
);

const ENABLED_TABS = new Set<InspectorTabKey>(["inspect", "rules", "trace"]);

interface InspectorPanelProps {
  /** Rules 탭 내용. */
  readonly rulesTab: ReactNode;
}

/** 오른쪽 레일 컨테이너. */
export function InspectorPanel({ rulesTab }: InspectorPanelProps) {
  const value = useInspectorTab();
  const setValue = useSetInspectorTab();

  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        if (ENABLED_TABS.has(v as InspectorTabKey)) {
          setValue(v as InspectorTabKey);
        }
      }}
      className="flex h-full flex-col min-h-0"
    >
      <InspectorTabs value={value} />
      <TabsContent value="inspect" className="flex-1 overflow-y-auto min-h-0">
        <InspectTab />
      </TabsContent>
      <TabsContent value="rules" className="flex-1 overflow-y-auto min-h-0">
        {rulesTab}
      </TabsContent>
      <TabsContent value="trace" className="flex-1 overflow-y-auto min-h-0">
        <Suspense fallback={null}>
          <TraceTab />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
