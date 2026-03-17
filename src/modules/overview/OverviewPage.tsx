import { useQuery } from '@tanstack/react-query'
import type {
  EventItem,
  NginxProxy,
  Node,
  Server,
  ServerMetricsSample,
} from '../../api/types'
import { fetchServers } from '../../api/servers'
import { fetchNodes } from '../../api/nodes'
import { fetchNginxProxies } from '../../api/nginx'
import { fetchEvents } from '../../api/events'
import { fetchServerMetrics } from '../../api/metrics'
import styles from './OverviewPage.module.css'

export function OverviewPage() {
  const { data: servers } = useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: () => fetchServers(),
  })
  const { data: nodes } = useQuery<Node[]>({
    queryKey: ['nodes'],
    queryFn: () => fetchNodes(),
  })
  const { data: nginxProxies } = useQuery<NginxProxy[]>({
    queryKey: ['nginx'],
    queryFn: () => fetchNginxProxies(),
  })
  const { data: events = [] } = useQuery<EventItem[]>({
    queryKey: ['events'],
    queryFn: () => fetchEvents(),
  })

  const { data: metrics } = useQuery<ServerMetricsSample[]>({
    queryKey: ['metrics', 'servers'],
    queryFn: () => fetchServerMetrics(),
    staleTime: 5_000,
  })

  const serversCount = servers?.length ?? 0
  const nodesCount = nodes?.length ?? 0
  const nginxCount = nginxProxies?.length ?? 0
  const warnings = events?.filter((e) => e.severity === 'warning').length ?? 0

  const avgCpu =
    metrics && metrics.length
      ? Math.round(
          metrics.reduce((sum, m) => sum + (m.cpu ?? 0), 0) / metrics.length,
        )
      : 0

  const avgRam =
    metrics && metrics.length
      ? Math.round(
          metrics.reduce((sum, m) => sum + (m.ram ?? 0), 0) / metrics.length,
        )
      : 0

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Servers"
          primary={serversCount.toString()}
          hint="Hosts online"
        />
        <StatCard
          label="Agents"
          primary={nodesCount.toString()}
          hint="Connected nodes"
        />
        <StatCard
          label="Nginx proxies"
          primary={nginxCount.toString()}
          hint="Configured domains"
        />
        <StatCard
          label="Alerts"
          primary={warnings.toString()}
          accent="warn"
          hint="Recent warnings"
        />
        <StatCard
          label="Panel status"
          primary={`${avgCpu}% / ${avgRam}%`}
          accent="ok"
          hint="Avg CPU / RAM across servers"
        />
        <StatCard
          label="Config drift"
          primary="0"
          hint="Out-of-sync nodes"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-slate-100">
                Recent activity
              </div>
              <div className="text-xs text-slate-500">
                Last operations across nginx, servers and agents
              </div>
            </div>
          </div>
          <div className={styles.eventsCard}>
            <ul className={styles.eventsList}>
              {(events ?? []).map((event) => (
                <li key={event.id} className={styles.eventItem}>
                  <div className={styles.eventMain}>
                    <span className={styles.eventKind}>
                      {event.kind.replace('_', ' ')}
                    </span>
                    <span className={styles.eventSummary}>{event.summary}</span>
                  </div>
                  <div className={styles.eventMeta}>
                    <span className={styles.eventTarget}>
                      {event.targetLabel}
                    </span>
                    <span className={styles.eventTime}>{event.timestamp}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-slate-100">
                Backend agents
              </div>
              <div className="text-xs text-slate-500">
                Mock heartbeat of aggregated API
              </div>
            </div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthRow}>
              <span className={styles.healthLabel}>Core API</span>
              <span className={styles.healthPill}>reachable</span>
            </div>
            <div className={styles.healthRow}>
              <span className={styles.healthLabel}>nginx adapter</span>
              <span className={styles.healthPill}>reachable</span>
            </div>
            <div className={styles.healthRow}>
              <span className={styles.healthLabel}>nodes adapter</span>
              <span className={styles.healthPill}>reachable</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

type StatCardProps = {
  label: string
  primary: string
  accent?: 'ok' | 'warn'
  hint?: string
}

function StatCard({ label, primary, accent, hint }: StatCardProps) {
  return (
    <article className={styles.statCard}>
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statPrimary}>{primary}</div>
        {hint ? <div className={styles.statHint}>{hint}</div> : null}
      </div>
      {accent ? (
        <div className={styles.statBadge}>
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              accent === 'ok'
                ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.5)]'
                : 'bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.5)]',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <span>{accent === 'ok' ? 'ok' : 'attention'}</span>
        </div>
      ) : null}
    </article>
  )
}

