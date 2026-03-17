export type HealthStatus = 'healthy' | 'degraded' | 'down'

export type ServerTier = 'prod' | 'stage' | 'dev'

export interface Server {
  id: string
  name: string
  hostname: string
  ip: string
  tier: ServerTier
  status: HealthStatus
  cpu: number
  ram: number
  agentsCount: number
  nginxCount: number
}

export interface Node {
  id: string
  serverId: string
  version: string
  status: HealthStatus
  lastPing: string
}

export interface NginxProxy {
  id: string
  domain: string
  upstream: string
  status: HealthStatus
  sslValidTo: string
  sslDaysLeft: number
  serverId: string
}

export interface EventItem {
  id: string
  timestamp: string
  kind: 'nginx_reload' | 'agent_restart' | 'server_down' | 'config_change'
  summary: string
  targetLabel: string
  severity: 'info' | 'warning' | 'error'
}

export interface TopologyNode {
  id: string
  type: 'server' | 'node' | 'nginx' | 'upstream_group'
  label: string
  status: HealthStatus
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
}

export interface ServerMetricsSample {
  id: number
  serverId: string
  agentId: string
  timestamp: string
  cpu: number
  ram: number
  diskUsedPercent: number | null
  netRxBytes: number | null
  netTxBytes: number | null
}

export interface NginxFlowSample {
  id: number
  proxyId: string
  sni: string
  upstreamName: string
  upstreamAddr: string
  status: HealthStatus
  windowStart: string
  windowEnd: string
  sessions: number
  bytesSent: number
  bytesReceived: number
  avgSessionTime: number | null
  maxSessionTime: number | null
}


