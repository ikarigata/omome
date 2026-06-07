import { apiClient } from '../client'
import type {
  WorkoutSetResponse,
  WorkoutSetCreateRequest,
  WorkoutSetUpdateRequest,
} from '../types'

export const workoutSetsApi = {
  listByRecord: (workoutRecordId: string) =>
    apiClient.get<WorkoutSetResponse[]>(`/workout-records/${workoutRecordId}/workout-sets`),

  get: (id: string) => apiClient.get<WorkoutSetResponse>(`/workout-sets/${id}`),

  create: (workoutRecordId: string, data: WorkoutSetCreateRequest) =>
    apiClient.post<WorkoutSetResponse>(`/workout-records/${workoutRecordId}/workout-sets`, data),

  update: (id: string, data: WorkoutSetUpdateRequest) =>
    apiClient.put<WorkoutSetResponse>(`/workout-sets/${id}`, data),

  remove: (id: string) => apiClient.delete<void>(`/workout-sets/${id}`),
}
