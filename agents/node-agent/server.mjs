import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import fetch from 'node-fetch'

const agentId = process.env.AGENT_ID ?? `agent-${os.hostname()}`
const role = process.env.AGENT_ROLE ?? 'node'
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000'
const serverId = process.env.SERVER_ID ?? os.hostname()
const serverName = process.env.SERVER_NAME ?? os.hostname()
const serverIp = process.env.SERVER_IP ?? '0.0.0.0'
const serverTier = process.env.SERVER_TIER ?? 'prod'
const heartbeatIntervalSec = Number(process.env.HEARTBEAT_INTERVAL_SEC ?? '15')
const nginxLogPath =
  process.env.NGINX_STREAM_LOG ?? '/var/log/nginx/stream_access.log'
const nginxProxyId = process.env.NGINX_PROXY_ID ?? serverId
const nginxWindowSec = Number(process.env.NGINX_WINDOW_SEC ?? '10')

function readSystemMetrics() {
  const load = os.loadavg()[0] ?? 0
  const cpus = os.cpus().length || 1
  const cpu = Math.min(100, Math.max(0, (load / cpus) * 100))

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const ram = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0

  return { cpu, ram }
}

async function sendHeartbeat() {
  const metrics = readSystemMetrics()
  const payload = {
    server: {
      id: serverId,
      name: serverName,
      hostname: os.hostname(),
      ip: serverIp,
      tier: serverTier,
    },
    agent: {
      id: agentId,
      role,
      version: '0.1.0',
    },
    metrics,
  }

  try {
    const res = await fetch(new URL('/api/agent/heartbeat', backendUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('heartbeat failed', res.status)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('heartbeat error', error)
  }
}

let lastLogSize = 0

function parseNginxLine(line) {
  // remote_addr [time_local] sni=... backend=... status=... bytes_sent=... bytes_received=... session_time=...
  const sniMatch = line.match(/sni=([^ ]+)/)
  const backendMatch = line.match(/backend=([^ ]+)/)
  const statusMatch = line.match(/status=(\\d+)/)
  const sentMatch = line.match(/bytes_sent=(\\d+)/)
  const recvMatch = line.match(/bytes_received=(\\d+)/)
  const timeMatch = line.match(/session_time=([0-9.]+)/)

  if (!backendMatch) return null

  const upstreamAddr = backendMatch[1]
  const [upstreamName] = upstreamAddr.split(':')

  return {
    sni: sniMatch ? sniMatch[1] : '-',
    upstreamName,
    upstreamAddr,
    status: Number(statusMatch?.[1] ?? '0') >= 500 ? 'degraded' : 'healthy',
    bytesSent: Number(sentMatch?.[1] ?? '0'),
    bytesReceived: Number(recvMatch?.[1] ?? '0'),
    sessionTime: Number(timeMatch?.[1] ?? '0'),
  }
}

async function collectNginxWindow() {
  return new Promise((resolve) => {
    fs.stat(nginxLogPath, (err, stats) => {
      if (err || !stats.isFile()) {
        resolve([])
        return
      }

      const start = lastLogSize
      const end = stats.size
      if (end <= start) {
        lastLogSize = end
        resolve([])
        return
      }

      const stream = fs.createReadStream(nginxLogPath, {
        encoding: 'utf8',
        start,
        end: end - 1,
      })

      const lines = []
      let buf = ''

      stream.on('data', (chunk) => {
        buf += chunk
        const parts = buf.split('\\n')
        buf = parts.pop() ?? ''
        for (const line of parts) {
          if (line.trim().length > 0) lines.push(line.trim())
        }
      })

      stream.on('end', () => {
        lastLogSize = end
        const parsed = lines
          .map((l) => parseNginxLine(l))
          .filter(Boolean)
        resolve(parsed)
      })

      stream.on('error', () => {
        resolve([])
      })
    })
  })
}

async function sendNginxFlow() {
  if (role !== 'proxy') return

  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - nginxWindowSec * 1000)

  const samples = await collectNginxWindow()
  if (!samples.length) return

  const key = (s) =>
    [s.sni, s.upstreamName, s.upstreamAddr, s.status].join('|')

  const aggregates = new Map()

  for (const s of samples) {
    const k = key(s)
    const current = aggregates.get(k) ?? {
      sni: s.sni,
      upstreamName: s.upstreamName,
      upstreamAddr: s.upstreamAddr,
      status: s.status,
      sessions: 0,
      bytesSent: 0,
      bytesReceived: 0,
      totalSessionTime: 0,
      maxSessionTime: 0,
    }

    current.sessions += 1
    current.bytesSent += s.bytesSent
    current.bytesReceived += s.bytesReceived
    current.totalSessionTime += s.sessionTime
    current.maxSessionTime = Math.max(current.maxSessionTime, s.sessionTime)
    aggregates.set(k, current)
  }

  const payload = {
    proxyId: nginxProxyId,
    agentId: agentId,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    samples: Array.from(aggregates.values()).map((a) => ({
      sni: a.sni,
      upstreamName: a.upstreamName,
      upstreamAddr: a.upstreamAddr,
      status: a.status,
      sessions: a.sessions,
      bytesSent: a.bytesSent,
      bytesReceived: a.bytesReceived,
      avgSessionTime:
        a.sessions > 0 ? a.totalSessionTime / a.sessions : undefined,
      maxSessionTime: a.maxSessionTime || undefined,
    })),
  }

  try {
    const res = await fetch(new URL('/api/agent/nginx-flow', backendUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('nginx-flow failed', res.status)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('nginx-flow error', error)
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(
    `Agent ${agentId} starting, role=${role}, backend=${backendUrl}, server=${serverId}`,
  )

  setInterval(sendHeartbeat, heartbeatIntervalSec * 1000)

  if (role === 'proxy') {
    // ensure path exists to avoid noisy errors on startup
    const dir = path.dirname(nginxLogPath)
    if (fs.existsSync(dir)) {
      setInterval(sendNginxFlow, nginxWindowSec * 1000)
    }
  }

  // send first heartbeat immediately
  sendHeartbeat().catch(() => {})
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('agent fatal error', error)
})
