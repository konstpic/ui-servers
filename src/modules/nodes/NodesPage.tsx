import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Node } from '../../api/types'
import { fetchNodes, restartNode, rolloutNode } from '../../api/nodes'
import { useToast } from '../../components/Toasts/ToastContext'

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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-100">Agents / nodes</div>
          <div className="text-xs text-slate-500">
            Processes installed on servers exposing the panel API
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(nodes ?? []).map((node) => (
          <article
            key={node.id}
            className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <header className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-50">
                  {node.id}
                </span>
                <span className="text-xs text-slate-500">{node.serverId}</span>
              </div>
              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-200">
                v{node.version}
              </span>
            </header>
            <dl className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={node.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Last ping</dt>
                <dd className="font-mono text-slate-200">
                  {node.lastPing ? `${node.lastPing} ms` : '–'}
                </dd>
              </div>
            </dl>
            <footer className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-900"
                onClick={() => restart.mutate(node.id)}
                disabled={restart.isPending || creating}
              >
                Restart agent
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
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

