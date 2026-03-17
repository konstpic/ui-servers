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
import layoutStyles from '../../components/Layout/Layout.module.css'
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
    <div className={styles.root}>
      <section className={layoutStyles.grid}>
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

      <section className={layoutStyles.gridTwo}>
        <div>
          <div className={layoutStyles.sectionHeader}>
            <div>
              <div className={layoutStyles.sectionTitle}>Recent activity</div>
              <div className={layoutStyles.sectionHelp}>
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

        <div>
          <div className={layoutStyles.sectionHeader}>
            <div>
              <div className={layoutStyles.sectionTitle}>Backend agents</div>
              <div className={layoutStyles.sectionHelp}>
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
              layoutStyles.badgeDot,
              accent === 'ok'
                ? layoutStyles.badgeDotOk
                : layoutStyles.badgeDotWarn,
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

