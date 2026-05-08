import { Tabs, TabsContent } from "~ui/index.js";
import {
  useInspectorTab,
  useSetInspectorTab,
  type InspectorTab as InspectorTabKey,
} from "~state/ui/index.js";
import { InspectorTabs } from "./InspectorTabs.js";
import { InspectTab } from "./tabs/inspect/InspectTab.js";
import { RulesTab } from "./tabs/rules/RulesTab.js";
import { TraceTab } from "./tabs/trace/TraceTab.js";

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
        <RulesTab />
      </TabsContent>
      <TabsContent value="trace" className="flex-1 overflow-y-auto min-h-0">
        <TraceTab />
      </TabsContent>
    </Tabs>
  );
}
