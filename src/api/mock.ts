import type {
  EventItem,
  NginxProxy,
  Node,
  Server,
  TopologyEdge,
  TopologyNode,
} from './types'

const servers: Server[] = [
  {
    id: 'srv-1',
    name: 'edge-paris-1',
    hostname: 'edge-paris-1.internal',
    ip: '10.20.1.10',
    tier: 'prod',
    status: 'healthy',
    cpu: 34,
    ram: 61,
    agentsCount: 3,
    nginxCount: 5,
  },
  {
    id: 'srv-2',
    name: 'edge-fra-1',
    hostname: 'edge-fra-1.internal',
    ip: '10.20.3.10',
    tier: 'prod',
    status: 'degraded',
    cpu: 78,
    ram: 82,
    agentsCount: 2,
    nginxCount: 4,
  },
  {
    id: 'srv-3',
    name: 'stage-api-1',
    hostname: 'stage-api-1.internal',
    ip: '10.30.1.5',
    tier: 'stage',
    status: 'healthy',
    cpu: 22,
    ram: 47,
    agentsCount: 1,
    nginxCount: 1,
  },
]

const nodes: Node[] = [
  {
    id: 'agt-paris-01',
    serverId: 'srv-1',
    version: '0.4.2',
    status: 'healthy',
    lastPing: '2026-03-17T09:24:00Z',
  },
  {
    id: 'agt-paris-02',
    serverId: 'srv-1',
    version: '0.4.2',
    status: 'healthy',
    lastPing: '2026-03-17T09:24:10Z',
  },
  {
    id: 'agt-fra-01',
    serverId: 'srv-2',
    version: '0.4.1',
    status: 'degraded',
    lastPing: '2026-03-17T09:23:40Z',
  },
  {
    id: 'agt-stage-01',
    serverId: 'srv-3',
    version: '0.4.2',
    status: 'healthy',
    lastPing: '2026-03-17T09:24:30Z',
  },
]

const nginxProxies: NginxProxy[] = [
  {
    id: 'ngx-1',
    domain: 'panel.example.com',
    upstream: 'srv-1:8443',
    status: 'healthy',
    sslValidTo: '2027-01-14T00:00:00Z',
    sslDaysLeft: 290,
    serverId: 'srv-1',
  },
  {
    id: 'ngx-2',
    domain: 'api.example.com',
    upstream: 'srv-2:9000',
    status: 'degraded',
    sslValidTo: '2026-04-02T00:00:00Z',
    sslDaysLeft: 16,
    serverId: 'srv-2',
  },
  {
    id: 'ngx-3',
    domain: 'stage-api.example.com',
    upstream: 'srv-3:9000',
    status: 'healthy',
    sslValidTo: '2026-11-04T00:00:00Z',
    sslDaysLeft: 210,
    serverId: 'srv-3',
  },
]

const events: EventItem[] = [
  {
    id: 'e1',
    timestamp: '2026-03-17T09:22:10Z',
    kind: 'nginx_reload',
    summary: 'nginx reload applied on edge-paris-1',
    targetLabel: 'panel.example.com',
    severity: 'info',
  },
  {
    id: 'e2',
    timestamp: '2026-03-17T09:18:42Z',
    kind: 'agent_restart',
    summary: 'agent agt-fra-01 restarted',
    targetLabel: 'edge-fra-1',
    severity: 'warning',
  },
  {
    id: 'e3',
    timestamp: '2026-03-17T09:14:02Z',
    kind: 'config_change',
    summary: 'nginx site api.example.com updated',
    targetLabel: 'api.example.com',
    severity: 'info',
  },
]

const topologyNodes: TopologyNode[] = [
  ...nginxProxies.map((n) => ({
    id: n.id,
    type: 'nginx' as const,
    label: n.domain,
    status: n.status,
  })),
  ...servers.map((s) => ({
    id: s.id,
    type: 'server' as const,
    label: s.name,
    status: s.status,
  })),
  ...nodes.map((n) => ({
    id: n.id,
    type: 'node' as const,
    label: n.id,
    status: n.status,
  })),
]

const topologyEdges: TopologyEdge[] = [
  { id: 'edge-ngx1-srv1', source: 'ngx-1', target: 'srv-1' },
  { id: 'edge-ngx2-srv2', source: 'ngx-2', target: 'srv-2' },
  { id: 'edge-ngx3-srv3', source: 'ngx-3', target: 'srv-3' },
  { id: 'edge-node-paris-01', source: 'srv-1', target: 'agt-paris-01' },
  { id: 'edge-node-paris-02', source: 'srv-1', target: 'agt-paris-02' },
  { id: 'edge-node-fra-01', source: 'srv-2', target: 'agt-fra-01' },
  { id: 'edge-node-stage-01', source: 'srv-3', target: 'agt-stage-01' },
]

function delayed<T>(value: T, delayMs = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs))
}

export const mockApi = {
  listServers: () => delayed(servers),
  listNodes: () => delayed(nodes),
  listNginxProxies: () => delayed(nginxProxies),
  listEvents: () => delayed(events),
  topology: () => delayed({ nodes: topologyNodes, edges: topologyEdges }),
}

