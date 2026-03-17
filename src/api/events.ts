import type { EventItem } from './types'
import { apiClient } from './client'

export function fetchEvents() {
  return apiClient.get<EventItem[]>('/events')
}

