import { apiClient } from '../client'
import type {
  WorkoutDayResponse,
  WorkoutDayCreateRequest,
  WorkoutDayUpdateRequest,
  CalendarResponse,
} from '../types'

export const workoutDaysApi = {
  list: () => apiClient.get<WorkoutDayResponse[]>('/workout-days'),

  get: (id: string) => apiClient.get<WorkoutDayResponse>(`/workout-days/${id}`),

  create: (data: WorkoutDayCreateRequest) =>
    apiClient.post<WorkoutDayResponse>('/workout-days', data),

  update: (id: string, data: WorkoutDayUpdateRequest) =>
    apiClient.put<WorkoutDayResponse>(`/workout-days/${id}`, data),

  remove: (id: string) => apiClient.delete<void>(`/workout-days/${id}`),

  calendar: (year: number, month: number) =>
    apiClient.get<CalendarResponse>(`/workout-days/calendar?year=${year}&month=${month}`),
}
