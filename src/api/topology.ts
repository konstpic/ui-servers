import type { TopologyEdge, TopologyNode } from './types'
import { apiClient } from './client'

export type TopologyResponse = {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export function fetchTopology() {
  return apiClient.get<TopologyResponse>('/topology')
}

