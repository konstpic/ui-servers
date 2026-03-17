import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NginxFlowSample, NginxProxy } from '../../api/types'
import { fetchNginxProxies, reloadNginx, toggleNginx } from '../../api/nginx'
import { fetchNginxMetrics } from '../../api/metrics'
import { useToast } from '../../components/Toasts/ToastContext'

export function NginxPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: proxies } = useQuery<NginxProxy[]>({
    queryKey: ['nginx'],
    queryFn: () => fetchNginxProxies(),
  })

  const { data: flow } = useQuery<NginxFlowSample[]>({
    queryKey: ['metrics', 'nginx'],
    queryFn: () => fetchNginxMetrics({ sinceMinutes: 5, limit: 200 }),
    refetchInterval: 10_000,
  })

  const byDomain =
    flow?.reduce<Record<string, NginxFlowSample[]>>((acc, sample) => {
      const key = sample.sni === '-' ? sample.upstreamName : sample.sni
      if (!acc[key]) acc[key] = []
      acc[key].push(sample)
      return acc
    }, {}) ?? {}

  const toggle = useMutation({
    mutationFn: (id: string) => toggleNginx(id),
    onSuccess: (_data, id) => {
      toast.push(`Toggle requested for ${id}`, 'success')
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => {
      toast.push('Failed to toggle nginx', 'error')
    },
  })

  const reload = useMutation({
    mutationFn: (id: string) => reloadNginx(id),
    onSuccess: (_data, id) => {
      toast.push(`Reload requested for ${id}`, 'success')
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => {
      toast.push('Failed to reload nginx', 'error')
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-100">Nginx proxies</div>
          <div className="text-xs text-slate-500">
            Domains, upstreams and SSL validity
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(proxies ?? []).map((proxy) => (
          <article
            key={proxy.id}
            className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <header className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-50">
                  {proxy.domain}
                </span>
                <span className="text-xs text-slate-500">
                  on {proxy.serverId}
                </span>
              </div>
              <StatusBadge status={proxy.status} />
            </header>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-slate-500">Upstream</span>
              <span className="font-mono text-slate-200">{proxy.upstream}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-slate-500">SSL</span>
              <span className="font-mono text-slate-200">
                valid, {proxy.sslDaysLeft} days left
              </span>
            </div>
            <footer className="mt-1 flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-900"
                onClick={() => toggle.mutate(proxy.id)}
                disabled={toggle.isPending}
              >
                Toggle enable
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
                onClick={() => reload.mutate(proxy.id)}
                disabled={reload.isPending}
              >
                Reload nginx
              </button>
            </footer>
          </article>
        ))}
      </div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-100">Live traffic</div>
          <div className="text-xs text-slate-500">
            Aggregated flow per SNI / upstream over last 5 minutes
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Object.entries(byDomain).map(([key, samples]) => {
          const totalSessions = samples.reduce(
            (sum, s) => sum + (s.sessions ?? 0),
            0,
          )
          const totalBytes =
            samples.reduce(
              (sum, s) => sum + (s.bytesSent ?? 0) + (s.bytesReceived ?? 0),
              0,
            ) / 1024

          return (
            <article
              key={key}
              className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3"
            >
              <header className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-50">
                    {key}
                  </span>
                  <span className="text-xs text-slate-500">
                    {samples[0]?.proxyId ?? 'unknown proxy'}
                  </span>
                </div>
              </header>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-slate-500">Sessions</span>
                <span className="font-mono text-slate-200">
                  {totalSessions}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-slate-500">Traffic (approx)</span>
                <span className="font-mono text-slate-200">
                  {totalBytes.toFixed(1)} KiB
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {samples.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 px-2 py-1 text-[11px]"
                  >
                    <span className="font-mono text-slate-200">
                      {s.upstreamAddr}
                    </span>
                    <span className="text-slate-500">
                      {s.sessions} sessions,{' '}
                      {(s.bytesSent + s.bytesReceived) / 1024} KiB
                    </span>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

type Status = NginxProxy['status']

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

