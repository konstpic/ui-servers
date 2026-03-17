import type { NginxFlowSample, ServerMetricsSample } from './types'
import { apiClient } from './client'

export function fetchServerMetrics() {
  return apiClient.get<ServerMetricsSample[]>('/metrics/servers')
}

export function fetchNginxMetrics(params?: {
  sinceMinutes?: number
  limit?: number
}) {
  const search = new URLSearchParams()
  if (params?.sinceMinutes != null) {
    search.set('sinceMinutes', String(params.sinceMinutes))
  }
  if (params?.limit != null) {
    search.set('limit', String(params.limit))
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return apiClient.get<NginxFlowSample[]>(`/metrics/nginx${suffix}`)
}

