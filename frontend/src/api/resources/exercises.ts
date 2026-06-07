import { apiClient } from '../client'
import type { ExerciseResponse, ExerciseUpsertRequest } from '../types'

export const exercisesApi = {
  list: () => apiClient.get<ExerciseResponse[]>('/exercises'),

  get: (id: string) => apiClient.get<ExerciseResponse>(`/exercises/${id}`),

  create: (data: ExerciseUpsertRequest) => apiClient.post<ExerciseResponse>('/exercises', data),

  update: (id: string, data: ExerciseUpsertRequest) =>
    apiClient.put<ExerciseResponse>(`/exercises/${id}`, data),

  remove: (id: string) => apiClient.delete<void>(`/exercises/${id}`),
}
