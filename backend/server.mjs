import express from 'express'
import fetch from 'node-fetch'
import {
  addEvent,
  listEvents,
  listNginx,
  listNodes,
  listServers,
  upsertNginx,
  upsertNode,
  upsertServer,
  insertServerMetrics,
  listLatestServerMetrics,
  insertNginxFlowBatch,
  listRecentNginxFlow,
  listUpstreams,
} from './db.mjs'

const app = express()
const port = Number(process.env.PORT ?? 4000)

const agentUrls =
  (process.env.AGENT_URLS?.split(',').map((u) => u.trim()).filter(Boolean) ??
    []) || ['http://localhost:18081', 'http://localhost:18082']

app.use(express.json())

app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  )
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  next()
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, agents: agentUrls.length })
})

async function fetchAgent(url) {
  try {
    const [statusRes, metricsRes] = await Promise.all([
      fetch(new URL('/status', url)),
      fetch(new URL('/metrics', url)),
    ])

    const status = await statusRes.json()
    const metrics = await metricsRes.json()

    return { ok: true, url, status, metrics }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('agent fetch failed', url, error)
    return { ok: false, url }
  }
}

app.get('/api/events', (_req, res) => {
  res.json(listEvents(30))
})

app.get('/api/servers', (_req, res) => {
  res.json(listServers())
})

app.post('/api/servers', (req, res) => {
  const payload = req.body
  const server = {
    id: payload.id,
    name: payload.name,
    hostname: payload.hostname,
    ip: payload.ip,
    tier: payload.tier ?? 'prod',
    status: payload.status ?? 'healthy',
    cpu: payload.cpu ?? 0,
    ram: payload.ram ?? 0,
    agents_count: payload.agentsCount ?? 0,
    nginx_count: payload.nginxCount ?? 0,
  }
  upsertServer(server)
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'config_change',
    summary: `server ${server.name} upserted`,
    target_label: server.name,
    severity: 'info',
  })
  res.status(201).json(server)
})

app.get('/api/nodes', (_req, res) => {
  res.json(listNodes())
})

app.post('/api/nodes', (req, res) => {
  const payload = req.body
  const node = {
    id: payload.id,
    server_id: payload.serverId,
    version: payload.version ?? '0.0.1',
    status: payload.status ?? 'healthy',
    last_ping: payload.lastPing ?? new Date().toISOString(),
  }
  upsertNode(node)
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'config_change',
    summary: `node ${node.id} upserted`,
    target_label: node.server_id,
    severity: 'info',
  })
  res.status(201).json(node)
})

app.post('/api/nodes/:id/restart', (req, res) => {
  const { id } = req.params
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'agent_restart',
    summary: `agent ${id} restart requested`,
    target_label: id,
    severity: 'info',
  })
  res.json({ ok: true })
})

app.post('/api/nodes/:id/rollout', (req, res) => {
  const { id } = req.params
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'config_change',
    summary: `agent ${id} rollout triggered`,
    target_label: id,
    severity: 'info',
  })
  res.json({ ok: true })
})

app.get('/api/nginx', (_req, res) => {
  res.json(listNginx())
})

app.post('/api/nginx', (req, res) => {
  const payload = req.body
  const proxy = {
    id: payload.id,
    domain: payload.domain,
    upstream: payload.upstream,
    status: payload.status ?? 'healthy',
    ssl_valid_to:
      payload.sslValidTo ??
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
    ssl_days_left: payload.sslDaysLeft ?? 180,
    server_id: payload.serverId,
  }
  upsertNginx(proxy)
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'config_change',
    summary: `nginx ${proxy.domain} upserted`,
    target_label: proxy.domain,
    severity: 'info',
  })
  res.status(201).json(proxy)
})

app.post('/api/nginx/:id/toggle', (req, res) => {
  const { id } = req.params
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'nginx_reload',
    summary: `nginx ${id} toggle requested`,
    target_label: id,
    severity: 'info',
  })
  res.json({ ok: true })
})

app.post('/api/nginx/:id/reload', (req, res) => {
  const { id } = req.params
  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'nginx_reload',
    summary: `nginx ${id} reload requested`,
    target_label: id,
    severity: 'info',
  })
  res.json({ ok: true })
})

app.get('/api/upstreams', (_req, res) => {
  res.json(listUpstreams())
})

app.get('/api/metrics/servers', (_req, res) => {
  res.json(listLatestServerMetrics())
})

app.get('/api/metrics/nginx', (req, res) => {
  const limit = Number(req.query.limit ?? 200)
  const sinceMinutes = Number(req.query.sinceMinutes ?? 15)
  res.json(listRecentNginxFlow({ limit, sinceMinutes }))
})

app.post('/api/agent/heartbeat', (req, res) => {
  const { server, agent, metrics } = req.body ?? {}

  if (!server?.id || !agent?.id) {
    res.status(400).json({ ok: false, error: 'server.id and agent.id are required' })
    return
  }

  const serverRow = {
    id: server.id,
    name: server.name ?? server.id,
    hostname: server.hostname ?? server.id,
    ip: server.ip ?? '0.0.0.0',
    tier: server.tier ?? 'prod',
    status: server.status ?? 'healthy',
    cpu: metrics?.cpu ?? 0,
    ram: metrics?.ram ?? 0,
    agents_count: server.agentsCount ?? 0,
    nginx_count: server.nginxCount ?? 0,
  }

  const nodeRow = {
    id: agent.id,
    server_id: server.id,
    version: agent.version ?? '0.0.1',
    status: agent.status ?? 'healthy',
    last_ping: new Date().toISOString(),
  }

  upsertServer(serverRow)
  upsertNode(nodeRow)

  if (metrics) {
    insertServerMetrics({
      server_id: server.id,
      agent_id: agent.id,
      timestamp: new Date().toISOString(),
      cpu: metrics.cpu ?? 0,
      ram: metrics.ram ?? 0,
      disk_used_percent: metrics.diskUsedPercent ?? null,
      net_rx_bytes: metrics.netRxBytes ?? null,
      net_tx_bytes: metrics.netTxBytes ?? null,
    })
  }

  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'config_change',
    summary: `heartbeat from ${agent.id}`,
    target_label: server.id,
    severity: 'info',
  })

  res.json({ ok: true })
})

app.post('/api/agent/nginx-flow', (req, res) => {
  const { proxyId, agentId, windowStart, windowEnd, samples } = req.body ?? {}

  if (!proxyId || !windowStart || !windowEnd || !Array.isArray(samples)) {
    res.status(400).json({ ok: false, error: 'proxyId, windowStart, windowEnd, samples[] are required' })
    return
  }

  const rows = samples.map((s) => ({
    proxy_id: proxyId,
    sni: s.sni ?? '-',
    upstream_name: s.upstreamName ?? '-',
    upstream_addr: s.upstreamAddr ?? '-',
    status: s.status ?? 'healthy',
    window_start: windowStart,
    window_end: windowEnd,
    sessions: s.sessions ?? 0,
    bytes_sent: s.bytesSent ?? 0,
    bytes_received: s.bytesReceived ?? 0,
    avg_session_time: s.avgSessionTime ?? null,
    max_session_time: s.maxSessionTime ?? null,
  }))

  insertNginxFlowBatch(rows)

  addEvent({
    timestamp: new Date().toISOString(),
    kind: 'config_change',
    summary: `nginx flow batch from ${proxyId} (${agentId ?? 'unknown'})`,
    target_label: proxyId,
    severity: 'info',
  })

  res.json({ ok: true, inserted: rows.length })
})

app.get('/api/topology', (_req, res) => {
  const servers = listServers()
  const nodes = listNodes()
  const nginx = listNginx()

  const topoNodes = []
  const edges = []

  const upstreamGroups = new Map()

  nginx.forEach((p) => {
    topoNodes.push({
      id: p.id,
      type: 'nginx',
      label: p.domain,
      status: p.status,
    })
    edges.push({
      id: `edge-${p.id}-${p.server_id}`,
      source: p.id,
      target: p.server_id,
    })

    if (p.upstream) {
      const upstreamId = `upstream-${p.upstream}`
      if (!upstreamGroups.has(upstreamId)) {
        upstreamGroups.set(upstreamId, {
          id: upstreamId,
          type: 'upstream_group',
          label: p.upstream,
          status: 'healthy',
        })
      }
      edges.push({
        id: `edge-${p.id}-${upstreamId}`,
        source: p.id,
        target: upstreamId,
      })
    }
  })

  servers.forEach((s) => {
    topoNodes.push({
      id: s.id,
      type: 'server',
      label: s.name,
      status: s.status,
    })
  })

  upstreamGroups.forEach((node) => {
    topoNodes.push(node)
  })

  nodes.forEach((n) => {
    topoNodes.push({
      id: n.id,
      type: 'node',
      label: n.id,
      status: n.status,
    })
    edges.push({
      id: `edge-${n.server_id}-${n.id}`,
      source: n.server_id,
      target: n.id,
    })
  })

  res.json({ nodes: topoNodes, edges })
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on ${port}, agents:`, agentUrls)
})


