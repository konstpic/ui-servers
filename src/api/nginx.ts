import type { NginxProxy } from './types'
import { apiClient } from './client'

export function fetchNginxProxies() {
  return apiClient.get<NginxProxy[]>('/nginx')
}

export function toggleNginx(id: string) {
  return apiClient.post<{ ok: boolean }>(`/nginx/${id}/toggle`)
}

export function reloadNginx(id: string) {
  return apiClient.post<{ ok: boolean }>(`/nginx/${id}/reload`)
}


