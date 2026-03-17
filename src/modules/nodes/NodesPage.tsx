import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Node } from '../../api/types'
import { fetchNodes, restartNode, rolloutNode } from '../../api/nodes'
import layoutStyles from '../../components/Layout/Layout.module.css'
import { useToast } from '../../components/Toasts/ToastContext'
import styles from './NodesPage.module.css'

export function NodesPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: nodes } = useQuery<Node[]>({
    queryKey: ['nodes'],
    queryFn: () => fetchNodes(),
  })

  const restart = useMutation({
    mutationFn: (id: string) => restartNode(id),
    onSuccess: (_data, id) => {
      toast.push(`Restart requested for ${id}`, 'success')
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => {
      toast.push('Failed to restart agent', 'error')
    },
  })

  const rollout = useMutation({
    mutationFn: (id: string) => rolloutNode(id),
    onSuccess: (_data, id) => {
      toast.push(`Rollout triggered for ${id}`, 'success')
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => {
      toast.push('Failed to rollout agent', 'error')
    },
  })

  const [creating] = useState(false)

  return (
    <div className={styles.root}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <div className={layoutStyles.sectionTitle}>Agents / nodes</div>
          <div className={layoutStyles.sectionHelp}>
            Processes installed on servers exposing the panel API
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {(nodes ?? []).map((node) => (
          <article key={node.id} className={styles.card}>
            <header className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <span className={styles.cardId}>{node.id}</span>
                <span className={styles.cardServer}>{node.serverId}</span>
              </div>
              <span className={styles.versionPill}>v{node.version}</span>
            </header>
            <dl className={styles.metaList}>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={node.status} />
                </dd>
              </div>
              <div>
                <dt>Last ping</dt>
                <dd>{node.lastPing}</dd>
              </div>
            </dl>
            <footer className={styles.cardFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => restart.mutate(node.id)}
                disabled={restart.isPending || creating}
              >
                Restart agent
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => rollout.mutate(node.id)}
                disabled={rollout.isPending || creating}
              >
                Rollout update
              </button>
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}

type Status = Node['status']

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

