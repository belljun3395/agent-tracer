import { TabsList, TabsTrigger } from "~web/shared/ui/index.js";

interface InspectorTabsProps {
  /** 현재 활성 탭. */
  readonly value: string;
}

/** 오른쪽 레일의 탭 스트립 헤더. */
export function InspectorTabs({ value }: InspectorTabsProps) {
  return (
    <TabsList className="px-3.5">
      <TabsTrigger value="inspect">Inspect</TabsTrigger>
      <TabsTrigger value="rules">Rules</TabsTrigger>
      <TabsTrigger value="trace">Trace</TabsTrigger>

      {/* value를 참조해 React가 미사용 prop 경고를 내지 않게 한다 */}
      <span hidden aria-hidden data-active={value} />
    </TabsList>
  );
}
