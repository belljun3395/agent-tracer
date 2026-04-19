export interface WebConfig {
  readonly apiBaseUrl: string
  readonly wsBaseUrl: string
}

export interface ViteMonitorConfig {
  readonly monitorHttpBaseUrl: string
  readonly monitorWsBaseUrl: string
  readonly webApiBaseUrl: string
  readonly webWsBaseUrl: string
}

function normalizeBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/g, '') ?? ''
}

function normalizeProtocol(value: string | undefined): 'http' | 'https' {
  return value === 'https' ? 'https' : 'http'
}

function normalizePort(value: string | undefined): number {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3847
}

export function resolveViteMonitorConfig(env: Record<string, string | undefined>): ViteMonitorConfig {
  const protocol = normalizeProtocol(env.MONITOR_PROTOCOL)
  const publicHost = env.MONITOR_PUBLIC_HOST?.trim() || '127.0.0.1'
  const port = normalizePort(env.MONITOR_PORT)
  const monitorHttpBaseUrl = normalizeBaseUrl(env.MONITOR_BASE_URL)
    || `${protocol}://${publicHost}:${port}`
  const monitorWsBaseUrl = normalizeBaseUrl(env.MONITOR_WS_BASE_URL)
    || `${protocol === 'https' ? 'wss' : 'ws'}://${publicHost}:${port}`

  return {
    monitorHttpBaseUrl,
    monitorWsBaseUrl,
    webApiBaseUrl: normalizeBaseUrl(env.VITE_MONITOR_BASE_URL),
    webWsBaseUrl: normalizeBaseUrl(env.VITE_MONITOR_WS_BASE_URL),
  }
}

export function loadWebConfig(): WebConfig {
  const apiBase = import.meta.env['VITE_MONITOR_BASE_URL'] as string | undefined
  const wsBase = import.meta.env['VITE_MONITOR_WS_BASE_URL'] as string | undefined
  return {
    apiBaseUrl: apiBase ?? 'http://127.0.0.1:3847',
    wsBaseUrl: wsBase ?? 'ws://127.0.0.1:3847',
  }
}
