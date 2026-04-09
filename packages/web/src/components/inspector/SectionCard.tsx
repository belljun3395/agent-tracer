/**
 * 재사용 가능한 카드 래퍼 컴포넌트.
 * 헤더(제목 + 선택적 액션)와 본문으로 구성된 inspector 섹션 카드.
 */

import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import { PanelCard } from "../ui/PanelCard.js";
import { cardShell, cardHeader, cardBody } from "./styles.js";

export function SectionCard({
  title,
  action,
  children,
  bodyClassName,
  className
}: {
  readonly title: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly bodyClassName?: string;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <PanelCard className={cn(cardShell, className)}>
      <div className={cardHeader}>
        <div className="min-w-0">{title}</div>
        {action}
      </div>
      <div className={cn(cardBody, bodyClassName)}>{children}</div>
    </PanelCard>
  );
}
