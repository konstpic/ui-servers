import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import type { Server } from '../../api/types'
import { fetchServers, upsertServer } from '../../api/servers'
import { useToast } from '../../components/Toasts/ToastContext'

export function ServersPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: servers } = useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: () => fetchServers(),
  })

  const [newServer, setNewServer] = useState<Partial<Server>>({
    id: '',
    name: '',
    hostname: '',
    ip: '',
    tier: 'prod',
  })

  const mutation = useMutation({
    mutationFn: (payload: Server) => upsertServer(payload),
    onSuccess: () => {
      toast.push('Server saved', 'success')
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setNewServer({ id: '', name: '', hostname: '', ip: '', tier: 'prod' })
    },
    onError: () => {
      toast.push('Failed to save server', 'error')
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!newServer.id || !newServer.name || !newServer.hostname || !newServer.ip) {
      toast.push('Fill id, name, hostname and ip', 'error')
      return
    }
    mutation.mutate({
      id: newServer.id,
      name: newServer.name,
      hostname: newServer.hostname,
      ip: newServer.ip,
      tier: newServer.tier ?? 'prod',
      status: 'healthy',
      cpu: 0,
      ram: 0,
      agentsCount: 0,
      nginxCount: 0,
      agentName: null,
      agentPingMs: null,
      netRxBytes: null,
      netTxBytes: null,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-100">Servers</div>
          <div className="text-xs text-slate-500">
            Hosts with attached agents and nginx proxies
          </div>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={handleSubmit}
        >
          <input
            className="h-8 w-28 rounded-full border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 placeholder:text-slate-500"
            placeholder="id"
            value={newServer.id ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, id: e.target.value }))
            }
          />
          <input
            className="h-8 w-32 rounded-full border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 placeholder:text-slate-500"
            placeholder="name"
            value={newServer.name ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <input
            className="h-8 w-40 rounded-full border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 placeholder:text-slate-500"
            placeholder="hostname"
            value={newServer.hostname ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, hostname: e.target.value }))
            }
          />
          <input
            className="h-8 w-32 rounded-full border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 placeholder:text-slate-500"
            placeholder="ip"
            value={newServer.ip ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, ip: e.target.value }))
            }
          />
          <button
            type="submit"
            className="inline-flex h-8 items-center rounded-full bg-sky-500 px-3 text-xs font-semibold text-slate-950 hover:bg-sky-400"
            disabled={mutation.isPending}
          >
            Add
          </button>
        </form>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="grid grid-cols-[2.4fr_1fr_1.1fr_1.1fr_1.2fr_1.2fr_1.2fr_1.1fr_1.3fr_0.8fr] gap-2 border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Server</span>
          <span>IP</span>
          <span>Tier</span>
          <span>Status</span>
          <span>CPU</span>
          <span>RAM</span>
          <span>Agent</span>
          <span>Ping</span>
          <span>Net I/O</span>
          <span>Nginx</span>
        </div>
        <div className="flex flex-col">
          {(servers ?? []).map((server) => (
            <button
              type="button"
              key={server.id}
              className="grid grid-cols-[2.4fr_1fr_1.1fr_1.1fr_1.2fr_1.2fr_1.2fr_1.1fr_1.3fr_0.8fr] items-center gap-2 border-b border-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/80"
              aria-label={`Open details for ${server.name}`}
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-50">
                  {server.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {server.hostname}
                </span>
              </span>
              <span>{server.ip}</span>
              <span>
                <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                  {server.tier}
                </span>
              </span>
              <span>
                <StatusBadge status={server.status} />
              </span>
              <span>
                <MetricBar value={server.cpu} label={`${server.cpu}%`} />
              </span>
              <span>
                <MetricBar value={server.ram} label={`${server.ram}%`} />
              </span>
              <span>{server.agentName ?? 'node-exporter'}</span>
              <span>
                {server.agentPingMs != null ? `${server.agentPingMs} ms` : '–'}
              </span>
              <span>
                <NetIoCell
                  rx={server.netRxBytes}
                  tx={server.netTxBytes}
                />
              </span>
              <span>{server.nginxCount}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type Status = Server['status']

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] capitalize">
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          status === 'healthy'
            ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.4)]'
            : status === 'degraded'
              ? 'bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.4)]'
              : 'bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.4)]',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <span>{status}</span>
    </span>
  )
}

function MetricBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0))

  let tone: 'ok' | 'warn' | 'error' = 'ok'
  if (clamped >= 80) {
    tone = 'error'
  } else if (clamped >= 60) {
    tone = 'warn'
  }

  const toneClass =
    tone === 'ok'
      ? 'bg-gradient-to-r from-emerald-400 to-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
      : tone === 'warn'
        ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]'
        : 'bg-gradient-to-r from-rose-400 to-red-500 shadow-[0_0_10px_rgba(248,113,113,0.5)]'

  return (
    <div className="relative flex h-4 items-center overflow-hidden rounded-full border border-slate-800 bg-slate-950">
      <div
        className={toneClass}
        style={{ width: `${clamped}%` }}
        aria-hidden="true"
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-100">
        {label}
      </span>
    </div>
  )
}

function formatRate(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '–'
  const v = Math.max(0, value)
  if (v >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(1)} MB/s`
  }
  if (v >= 1_000) {
    return `${(v / 1_000).toFixed(1)} kB/s`
  }
  return `${Math.round(v)} B/s`
}

function NetIoCell({ rx, tx }: { rx: number | null; tx: number | null }) {
  return (
    <div className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
        <ArrowDownRight size={12} className="text-emerald-400" />
        <span>{formatRate(rx)}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300">
        <ArrowUpRight size={12} className="text-sky-400" />
        <span>{formatRate(tx)}</span>
      </span>
    </div>
  )
}


