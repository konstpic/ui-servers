import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Node, Server, ServerMetricsSample } from '../api/types'

type MetricsMessage =
  | {
      type: 'metrics_snapshot'
      at: string
      metrics: ServerMetricsSample[]
      servers: Server[]
      nodes: Node[]
    }
  | {
      type: 'metrics_update'
      at: string
      metrics: ServerMetricsSample[]
      servers: Server[]
      nodes: Node[]
    }

export function useLiveDataSocket() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const base =
      (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

    const url = new URL(base, window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/ws/metrics'

    const ws = new WebSocket(url.toString())

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as MetricsMessage
        if (
          parsed.type === 'metrics_snapshot' ||
          parsed.type === 'metrics_update'
        ) {
          queryClient.setQueryData(['metrics', 'servers'], parsed.metrics)
          queryClient.setQueryData(['servers'], parsed.servers)
          queryClient.setQueryData(['nodes'], parsed.nodes)
        }
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close()
      }
    }
  }, [queryClient])
}

