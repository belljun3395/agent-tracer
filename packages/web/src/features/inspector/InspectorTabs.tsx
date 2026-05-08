import { TabsList, TabsTrigger, type StatusKind } from "~ui/index.js";

interface InspectorTabsProps {
  /** Currently active tab — passed through Radix Tabs `value`. */
  readonly value: string;
}

/**
 * Tab strip header for the right rail. Three tabs: Inspect / Rules / Trace.
 */
export function InspectorTabs({ value }: InspectorTabsProps) {
  return (
    <TabsList className="px-3.5">
      <TabsTrigger value="inspect">Inspect</TabsTrigger>
      <TabsTrigger value="rules">Rules</TabsTrigger>
      <TabsTrigger value="trace">Trace</TabsTrigger>

      {/* keep one ref to value so React doesn't warn about an unused prop */}
      <span hidden aria-hidden data-active={value} />
    </TabsList>
  );
}

// Re-export StatusKind so consumers don't need a parallel import. Keeps
// the inspector's public surface contained at the feature root.
export type { StatusKind };
