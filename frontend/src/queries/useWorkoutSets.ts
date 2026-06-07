import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutSetsApi } from '@/api/resources/workoutSets'
import type { WorkoutSetCreateRequest, WorkoutSetUpdateRequest } from '@/api/types'
import { queryKeys } from './queryKeys'

export function useWorkoutSets(workoutRecordId: string) {
  return useQuery({
    queryKey: queryKeys.workoutRecords.sets(workoutRecordId),
    queryFn: () => workoutSetsApi.listByRecord(workoutRecordId),
    enabled: !!workoutRecordId,
  })
}

export function useCreateWorkoutSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      workoutRecordId,
      data,
    }: {
      workoutRecordId: string
      data: WorkoutSetCreateRequest
    }) => workoutSetsApi.create(workoutRecordId, data),
    onSuccess: (res) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.workoutRecords.sets(res.workoutRecordId),
      })
    },
  })
}

export function useUpdateWorkoutSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      workoutRecordId: _wrid,
      data,
    }: {
      id: string
      workoutRecordId: string
      data: WorkoutSetUpdateRequest
    }) => workoutSetsApi.update(id, data),
    onSuccess: (_res, { workoutRecordId }) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.workoutRecords.sets(workoutRecordId),
      })
    },
  })
}

export function useDeleteWorkoutSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, workoutRecordId: wrid }: { id: string; workoutRecordId: string }) =>
      workoutSetsApi.remove(id).then(() => ({ workoutRecordId: wrid })),
    onSuccess: ({ workoutRecordId }) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.workoutRecords.sets(workoutRecordId),
      })
    },
  })
}
