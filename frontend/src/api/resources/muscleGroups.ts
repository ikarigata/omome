import { apiClient } from '../client'
import type { MuscleGroupResponse } from '../types'

export const muscleGroupsApi = {
  list: () => apiClient.get<MuscleGroupResponse[]>('/muscle-groups'),

  get: (id: string) => apiClient.get<MuscleGroupResponse>(`/muscle-groups/${id}`),
}
