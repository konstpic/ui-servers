import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NginxFlowSample, NginxProxy } from '../../api/types'
import { fetchNginxProxies, reloadNginx, toggleNginx } from '../../api/nginx'
import { fetchNginxMetrics } from '../../api/metrics'
import layoutStyles from '../../components/Layout/Layout.module.css'
import { useToast } from '../../components/Toasts/ToastContext'
import styles from './NginxPage.module.css'

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
    <div className={styles.root}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <div className={layoutStyles.sectionTitle}>Nginx proxies</div>
          <div className={layoutStyles.sectionHelp}>
            Domains, upstreams and SSL validity
          </div>
        </div>
      </div>
      <div className={styles.grid}>
        {(proxies ?? []).map((proxy) => (
          <article key={proxy.id} className={styles.card}>
            <header className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <span className={styles.domain}>{proxy.domain}</span>
                <span className={styles.meta}>on {proxy.serverId}</span>
              </div>
              <StatusBadge status={proxy.status} />
            </header>
            <div className={styles.bodyRow}>
              <span className={styles.label}>Upstream</span>
              <span className={styles.value}>{proxy.upstream}</span>
            </div>
            <div className={styles.bodyRow}>
              <span className={styles.label}>SSL</span>
              <span className={styles.value}>
                valid, {proxy.sslDaysLeft} days left
              </span>
            </div>
            <footer className={styles.footer}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => toggle.mutate(proxy.id)}
                disabled={toggle.isPending}
              >
                Toggle enable
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => reload.mutate(proxy.id)}
                disabled={reload.isPending}
              >
                Reload nginx
              </button>
            </footer>
          </article>
        ))}
      </div>

      <div className={layoutStyles.sectionHeader}>
        <div>
          <div className={layoutStyles.sectionTitle}>Live traffic</div>
          <div className={layoutStyles.sectionHelp}>
            Aggregated flow per SNI / upstream over last 5 minutes
          </div>
        </div>
      </div>
      <div className={styles.flowGrid}>
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
            <article key={key} className={styles.flowCard}>
              <header className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <span className={styles.domain}>{key}</span>
                  <span className={styles.meta}>
                    {samples[0]?.proxyId ?? 'unknown proxy'}
                  </span>
                </div>
              </header>
              <div className={styles.bodyRow}>
                <span className={styles.label}>Sessions</span>
                <span className={styles.value}>{totalSessions}</span>
              </div>
              <div className={styles.bodyRow}>
                <span className={styles.label}>Traffic (approx)</span>
                <span className={styles.value}>{totalBytes.toFixed(1)} KiB</span>
              </div>
              <div className={styles.flowUpstreams}>
                {samples.map((s) => (
                  <div key={s.id} className={styles.flowUpstreamRow}>
                    <span className={styles.flowUpstreamAddr}>
                      {s.upstreamAddr}
                    </span>
                    <span className={styles.flowUpstreamMeta}>
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
    <span className={styles.statusBadge}>
      <span
        className={[
          styles.statusDot,
          status === 'healthy'
            ? styles.statusDotOk
            : status === 'degraded'
              ? styles.statusDotWarn
              : styles.statusDotError,
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <span className={styles.statusLabel}>{status}</span>
    </span>
  )
}

