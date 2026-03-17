import type { Server } from './types'
import { apiClient } from './client'

export function fetchServers() {
  return apiClient.get<Server[]>('/servers')
}

export function upsertServer(server: Server) {
  return apiClient.post<Server>('/servers', server)
}


