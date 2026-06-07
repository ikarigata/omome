import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exercisesApi } from '@/api/resources/exercises'
import type { ExerciseUpsertRequest } from '@/api/types'
import { queryKeys } from './queryKeys'

export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.all(),
    queryFn: () => exercisesApi.list(),
  })
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: queryKeys.exercises.detail(id),
    queryFn: () => exercisesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExerciseUpsertRequest) => exercisesApi.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.exercises.all() })
    },
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExerciseUpsertRequest }) =>
      exercisesApi.update(id, data),
    onSuccess: (_res, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.exercises.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.exercises.detail(id) })
    },
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => exercisesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.exercises.all() })
    },
  })
}
