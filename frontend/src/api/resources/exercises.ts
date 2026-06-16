import { apiClient } from '../client'
import type {
  ExerciseHistoryResponse,
  ExerciseProgressResponse,
  ExerciseResponse,
  ExerciseUpsertRequest,
} from '../types'

export const exercisesApi = {
  list: () => apiClient.get<ExerciseResponse[]>('/exercises'),

  get: (id: string) => apiClient.get<ExerciseResponse>(`/exercises/${id}`),

  progress: (id: string) =>
    apiClient.get<ExerciseProgressResponse>(`/exercises/${id}/progress`),

  history: (id: string) =>
    apiClient.get<ExerciseHistoryResponse>(`/exercises/${id}/history`),

  create: (data: ExerciseUpsertRequest) => apiClient.post<ExerciseResponse>('/exercises', data),

  update: (id: string, data: ExerciseUpsertRequest) =>
    apiClient.put<ExerciseResponse>(`/exercises/${id}`, data),

  remove: (id: string) => apiClient.delete<void>(`/exercises/${id}`),
}
