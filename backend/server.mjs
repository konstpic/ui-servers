import express from 'express'
import fetch from 'node-fetch'
import { WebSocketServer } from 'ws'
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

const wsClients = new Set()

// in-memory state for network rate calculation between scrapes
const netState = new Map()

// node-exporter targets in format: serverId=url;server2=url2
// Example:
// NODE_EXPORTERS=server-1=http://5.39.220.25:9100;server-2=http://fin.konstpic.ru:9100
const nodeExporterConfig =
  process.env.NODE_EXPORTERS?.split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [idPart, urlStr] = chunk.split('=')
      if (!idPart || !urlStr) return null
      try {
        const targetUrl = new URL(urlStr)
        return {
          serverId: idPart,
          url: targetUrl.toString(),
          host: targetUrl.hostname,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean) ?? []

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
  res.json({ ok: true, node_exporters: nodeExporterConfig.length })
})

app.get('/api/events', (_req, res) => {
  res.json(listEvents(30))
})

function buildEnrichedServers() {
  const servers = listServers()
  const latestMetrics = listLatestServerMetrics()
  // prefer technical "node-exporter" nodes (id === server_id) over legacy agents
  const allNodes = listNodes()
  const exporterNodes = allNodes.filter(
    (n) => n.id === n.server_id || n.version === 'node-exporter',
  )
  const nodeByServer = new Map(exporterNodes.map((n) => [n.server_id, n]))
  const metricsByServer = new Map(
    latestMetrics.map((m) => [m.server_id, m]),
  )

  return servers.map((s) => {
    const node = nodeByServer.get(s.id)
    const m = metricsByServer.get(s.id)
    return {
      id: s.id,
      name: s.name,
      hostname: s.hostname,
      ip: s.ip,
      tier: s.tier,
      status: s.status,
      cpu: s.cpu,
      ram: s.ram,
      agentsCount: s.agents_count,
      nginxCount: s.nginx_count,
      agentName: node?.version ?? null,
      agentPingMs:
        node && node.last_ping != null ? Number(node.last_ping) || 0 : null,
      netRxBytes: m?.net_rx_bytes ?? null,
      netTxBytes: m?.net_tx_bytes ?? null,
    }
  })
}

app.get('/api/servers', (_req, res) => {
  res.json(buildEnrichedServers())
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
  const rows = listNodes()
  res.json(
    rows.map((row) => ({
      id: row.id,
      serverId: row.server_id,
      version: row.version,
      status: row.status,
      lastPing: row.last_ping,
    })),
  )
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

function parsePrometheusMetrics(text) {
  const lines = text.split('\n')
  const map = new Map()
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const spaceIdx = line.lastIndexOf(' ')
    if (spaceIdx <= 0) continue
    const nameAndLabels = line.slice(0, spaceIdx)
    const valueStr = line.slice(spaceIdx + 1)
    const value = Number(valueStr)
    if (Number.isNaN(value)) continue
    map.set(nameAndLabels, value)
  }
  return map
}

function getMetricByPrefix(map, namePrefix) {
  for (const [key, value] of map.entries()) {
    if (key.startsWith(namePrefix)) return value
  }
  return undefined
}

async function pollNodeExporterOnce() {
  const updatedSamples = []
  for (const cfg of nodeExporterConfig) {
    try {
      const started = Date.now()
      const res = await fetch(new URL('/metrics', cfg.url))
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('node-exporter metrics failed', cfg.url, res.status)
        continue
      }
      const text = await res.text()
      const latencyMs = Date.now() - started
      const metrics = parsePrometheusMetrics(text)

      const totalMem =
        getMetricByPrefix(metrics, 'node_memory_MemTotal_bytes') ?? 0
      const availMem =
        getMetricByPrefix(metrics, 'node_memory_MemAvailable_bytes') ?? 0

      let ramPercent = 0
      if (totalMem > 0 && availMem >= 0) {
        const usedMem = totalMem - availMem
        ramPercent = (usedMem / totalMem) * 100
      }

      // aggregate network bytes across all non-loopback interfaces
      let rxTotal = 0
      let txTotal = 0
      for (const [key, value] of metrics.entries()) {
        if (
          key.startsWith('node_network_receive_bytes_total{') &&
          !key.includes('device="lo"')
        ) {
          rxTotal += value
        } else if (
          key.startsWith('node_network_transmit_bytes_total{') &&
          !key.includes('device="lo"')
        ) {
          txTotal += value
        }
      }

      let rxRate = null
      let txRate = null
      if (rxTotal > 0 || txTotal > 0) {
        const prev = netState.get(cfg.serverId)
        const nowMs = Date.now()
        if (prev && nowMs > prev.tsMs) {
          const dtSec = (nowMs - prev.tsMs) / 1000
          if (dtSec > 0) {
            const rxDelta = rxTotal - prev.rxTotal
            const txDelta = txTotal - prev.txTotal
            rxRate = rxDelta >= 0 ? rxDelta / dtSec : null
            txRate = txDelta >= 0 ? txDelta / dtSec : null
          }
        }
        netState.set(cfg.serverId, { rxTotal, txTotal, tsMs: nowMs })
      }

      // Fallback similar to старый агент: используем loadavg и число CPU
      const load1 = getMetricByPrefix(metrics, 'node_load1') ?? 0
      const cpus = getMetricByPrefix(metrics, 'node_cpu_seconds_total') ?? 1
      const cpuPercentRaw =
        cpus > 0 ? Math.min(100, Math.max(0, (load1 / cpus) * 100)) : 0

      const cpuPercent = Math.round(cpuPercentRaw)
      ramPercent = Math.round(ramPercent)

      const serverRow = {
        id: cfg.serverId,
        name: cfg.serverId,
        hostname: cfg.host,
        ip: cfg.host,
        tier: 'prod',
        status: 'healthy',
        cpu: cpuPercent,
        ram: ramPercent,
        agents_count: 0,
        nginx_count: 0,
      }

      const nowIso = new Date().toISOString()

      upsertServer(serverRow)
      insertServerMetrics({
        server_id: cfg.serverId,
        agent_id: 'node-exporter',
        timestamp: nowIso,
        cpu: cpuPercent,
        ram: ramPercent,
        disk_used_percent: null,
        net_rx_bytes: rxRate != null ? Math.max(0, Math.round(rxRate)) : null,
        net_tx_bytes: txRate != null ? Math.max(0, Math.round(txRate)) : null,
      })
      upsertNode({
        id: cfg.serverId,
        server_id: cfg.serverId,
        version: 'node-exporter',
        status: 'healthy',
        last_ping: `${latencyMs}`,
      })
      updatedSamples.push({
        server_id: cfg.serverId,
        timestamp: nowIso,
        cpu: cpuPercent,
        ram: ramPercent,
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('node-exporter poll error', cfg.url, error)
    }
  }

  if (updatedSamples.length && wsClients.size) {
    const nodes = listNodes().map((row) => ({
      id: row.id,
      serverId: row.server_id,
      version: row.version,
      status: row.status,
      lastPing: row.last_ping,
    }))

    const payload = JSON.stringify({
      type: 'metrics_update',
      at: new Date().toISOString(),
      metrics: listLatestServerMetrics(),
      servers: buildEnrichedServers(),
      nodes,
    })
    for (const ws of wsClients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload)
      }
    }
  }
}

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

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Backend listening on ${port}, node_exporters=${nodeExporterConfig.length}`,
  )
  if (nodeExporterConfig.length > 0) {
    const intervalSec = Number(
      process.env.NODE_EXPORTER_POLL_INTERVAL_SEC ?? '15',
    )
    // first tick
    pollNodeExporterOnce().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('node-exporter initial poll error', error)
    })
    // periodic ticks
    setInterval(() => {
      pollNodeExporterOnce().catch((error) => {
        // eslint-disable-next-line no-console
        console.error('node-exporter poll tick error', error)
      })
    }, intervalSec * 1000)
  }
})

const wss = new WebSocketServer({ server, path: '/ws/metrics' })

wss.on('connection', (ws) => {
  wsClients.add(ws)

  // отправляем текущие метрики сразу после подключения
  const snapshotMetrics = listLatestServerMetrics()
  const snapshotServers = buildEnrichedServers()
  const snapshotNodes = listNodes().map((row) => ({
    id: row.id,
    serverId: row.server_id,
    version: row.version,
    status: row.status,
    lastPing: row.last_ping,
  }))
  ws.send(
    JSON.stringify({
      type: 'metrics_snapshot',
      at: new Date().toISOString(),
      metrics: snapshotMetrics,
      servers: snapshotServers,
      nodes: snapshotNodes,
    }),
  )

  ws.on('close', () => {
    wsClients.delete(ws)
  })
})
