import type { Node } from './types'
import { apiClient } from './client'

export function fetchNodes() {
  return apiClient.get<Node[]>('/nodes')
}

export function restartNode(id: string) {
  return apiClient.post<{ ok: boolean }>(`/nodes/${id}/restart`)
}

export function rolloutNode(id: string) {
  return apiClient.post<{ ok: boolean }>(`/nodes/${id}/rollout`)
}


