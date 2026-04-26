import type React from "react";
import { cn } from "~app/lib/ui/cn.js";
import { HelpTooltip } from "../ui/HelpTooltip.js";
import { PanelCard } from "../ui/PanelCard.js";
import { cardShell, cardHeader, cardBody } from "./styles.js";
export function SectionCard({ title, helpText, action, children, bodyClassName, className }: {
    readonly title: React.ReactNode;
    readonly helpText?: string;
    readonly action?: React.ReactNode;
    readonly children: React.ReactNode;
    readonly bodyClassName?: string;
    readonly className?: string;
}): React.JSX.Element {
    return (<PanelCard className={cn(cardShell, className)}>
      <div className={cardHeader}>
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0">{title}</div>
          {helpText && <HelpTooltip text={helpText} className="mt-0.5"/>}
        </div>
        {action}
      </div>
      <div className={cn(cardBody, bodyClassName)}>{children}</div>
    </PanelCard>);
}
