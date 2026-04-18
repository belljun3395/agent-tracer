import type React from "react";
import type { ComponentProps } from "react";
import { EventInspector } from "./EventInspector.js";
type QuickInspectorProps = Omit<ComponentProps<typeof EventInspector>, "allowedTabs" | "initialTab" | "panelLabel" | "singleTabHeaderLayout">;
export function QuickInspector(props: QuickInspectorProps): React.JSX.Element {
    return (<EventInspector {...props} allowedTabs={["inspector"]} initialTab="inspector" panelLabel="Quick Inspect" singleTabHeaderLayout="inline"/>);
}
