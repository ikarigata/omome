import { apiClient } from '../client'
import type { WorkoutRecordResponse, WorkoutRecordUpsertRequest } from '../types'

export const workoutRecordsApi = {
  list: () => apiClient.get<WorkoutRecordResponse[]>('/workout-records'),

  listByDay: (workoutDayId: string) =>
    apiClient.get<WorkoutRecordResponse[]>(`/workout-days/${workoutDayId}/workout-records`),

  get: (id: string) => apiClient.get<WorkoutRecordResponse>(`/workout-records/${id}`),

  upsert: (data: WorkoutRecordUpsertRequest) =>
    apiClient.post<WorkoutRecordResponse>('/workout-records', data),

  update: (id: string, data: Partial<WorkoutRecordUpsertRequest>) =>
    apiClient.put<WorkoutRecordResponse>(`/workout-records/${id}`, data),

  remove: (id: string) => apiClient.delete<void>(`/workout-records/${id}`),
}
