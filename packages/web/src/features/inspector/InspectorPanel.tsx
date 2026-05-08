import { lazy, Suspense } from "react";
import { Tabs, TabsContent } from "~ui/index.js";
import {
  useInspectorTab,
  useSetInspectorTab,
  type InspectorTab as InspectorTabKey,
} from "~state/ui/index.js";
import { InspectorTabs } from "./InspectorTabs.js";
import { InspectTab } from "./tabs/inspect/InspectTab.js";

// Inspect is the default tab; the others ship as separate chunks so
// the inspector's right rail doesn't drag the rule-form modal and
// span-tree builder onto the initial paint.
const RulesTab = lazy(() =>
  import("./tabs/rules/RulesTab.js").then((m) => ({ default: m.RulesTab })),
);
const TraceTab = lazy(() =>
  import("./tabs/trace/TraceTab.js").then((m) => ({ default: m.TraceTab })),
);

const ENABLED_TABS = new Set<InspectorTabKey>(["inspect", "rules", "trace"]);

/**
 * Right rail container. Wires Inspect + Rules + Trace.
 */
export function InspectorPanel() {
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
        <Suspense fallback={null}>
          <RulesTab />
        </Suspense>
      </TabsContent>
      <TabsContent value="trace" className="flex-1 overflow-y-auto min-h-0">
        <Suspense fallback={null}>
          <TraceTab />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
