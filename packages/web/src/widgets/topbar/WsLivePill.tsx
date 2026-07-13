import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Pill, Tooltip } from "~web/shared/ui/index.js";

interface WsLivePillProps {
  readonly connected: boolean;
}

/**
 * monitor websocket의 연결 상태를 보여주는 필.
 *
 *   - 연결됨: "WS"
 *   - 끊김: "Reconnecting…"
 */
export function WsLivePill({ connected }: WsLivePillProps) {
  const guidance = useGuidance();
  if (!connected) {
    return (
      <Tooltip
        content={
          <GuidanceText
            locale={guidance.locale}
            message={guidance.messages.shell.websocketDisconnected}
          />
        }
        side="bottom"
      >
        <span>
          <Pill tone="warn" dot pulse>
            Reconnecting…
          </Pill>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      content={
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.shell.websocketConnected}
        />
      }
      side="bottom"
    >
      <span>
        <Pill tone="ok" dot pulse>
          WS
        </Pill>
      </span>
    </Tooltip>
  );
}
