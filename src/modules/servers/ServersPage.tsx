import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Server } from '../../api/types'
import { fetchServers, upsertServer } from '../../api/servers'
import layoutStyles from '../../components/Layout/Layout.module.css'
import { useToast } from '../../components/Toasts/ToastContext'
import styles from './ServersPage.module.css'

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
    })
  }

  return (
    <div className={styles.root}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <div className={layoutStyles.sectionTitle}>Servers</div>
          <div className={layoutStyles.sectionHelp}>
            Hosts with attached agents and nginx proxies
          </div>
        </div>
        <form
          className={layoutStyles.contentHeaderActions}
          onSubmit={handleSubmit}
        >
          <input
            className={styles.smallInput}
            placeholder="id"
            value={newServer.id ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, id: e.target.value }))
            }
          />
          <input
            className={styles.smallInput}
            placeholder="name"
            value={newServer.name ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <input
            className={styles.smallInput}
            placeholder="hostname"
            value={newServer.hostname ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, hostname: e.target.value }))
            }
          />
          <input
            className={styles.smallInput}
            placeholder="ip"
            value={newServer.ip ?? ''}
            onChange={(e) =>
              setNewServer((prev) => ({ ...prev, ip: e.target.value }))
            }
          />
          <button
            type="submit"
            className={styles.addButton}
            disabled={mutation.isPending}
          >
            Add
          </button>
        </form>
      </div>
      <div className={styles.table}>
        <div className={styles.headerRow}>
          <span>Server</span>
          <span>Tier</span>
          <span>Status</span>
          <span>CPU</span>
          <span>RAM</span>
          <span>Agents</span>
          <span>Nginx</span>
        </div>
        <div className={styles.body}>
          {(servers ?? []).map((server) => (
            <button
              type="button"
              key={server.id}
              className={styles.row}
              aria-label={`Open details for ${server.name}`}
            >
              <span className={styles.cellMain}>
                <span className={styles.serverName}>{server.name}</span>
                <span className={styles.serverMeta}>{server.hostname}</span>
              </span>
              <span>
                <span className={styles.tierPill}>{server.tier}</span>
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
              <span>{server.agentsCount}</span>
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
      ? styles.metricBarInnerOk
      : tone === 'warn'
        ? styles.metricBarInnerWarn
        : styles.metricBarInnerError

  return (
    <div className={styles.metricBar}>
      <div
        className={toneClass}
        style={{ width: `${clamped}%` }}
        aria-hidden="true"
      />
      <span className={styles.metricBarLabel}>{label}</span>
    </div>
  )
}


