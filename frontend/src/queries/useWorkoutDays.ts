import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutDaysApi } from '@/api/resources/workoutDays'
import type { WorkoutDayCreateRequest, WorkoutDayUpdateRequest } from '@/api/types'
import { queryKeys } from './queryKeys'

export function useWorkoutDays() {
  return useQuery({
    queryKey: queryKeys.workoutDays.all(),
    queryFn: () => workoutDaysApi.list(),
  })
}

export function useWorkoutDay(id: string) {
  return useQuery({
    queryKey: queryKeys.workoutDays.detail(id),
    queryFn: () => workoutDaysApi.get(id),
    enabled: !!id,
  })
}

export function useCreateWorkoutDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkoutDayCreateRequest) => workoutDaysApi.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.workoutDays.all() })
    },
  })
}

export function useUpdateWorkoutDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkoutDayUpdateRequest }) =>
      workoutDaysApi.update(id, data),
    onSuccess: (_res, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.workoutDays.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.workoutDays.detail(id) })
    },
  })
}

export function useDeleteWorkoutDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workoutDaysApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.workoutDays.all() })
    },
  })
}
