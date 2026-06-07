import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutRecordsApi } from '@/api/resources/workoutRecords'
import type { WorkoutRecordUpsertRequest } from '@/api/types'
import { queryKeys } from './queryKeys'

export function useWorkoutRecordsByDay(workoutDayId: string) {
  return useQuery({
    queryKey: queryKeys.workoutDays.records(workoutDayId),
    queryFn: () => workoutRecordsApi.listByDay(workoutDayId),
    enabled: !!workoutDayId,
  })
}

export function useWorkoutRecord(id: string) {
  return useQuery({
    queryKey: queryKeys.workoutRecords.detail(id),
    queryFn: () => workoutRecordsApi.get(id),
    enabled: !!id,
  })
}

export function useUpsertWorkoutRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkoutRecordUpsertRequest) => workoutRecordsApi.upsert(data),
    onSuccess: (res) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.workoutDays.records(res.workoutDayId),
      })
    },
  })
}

export function useDeleteWorkoutRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, workoutDayId }: { id: string; workoutDayId: string }) =>
      workoutRecordsApi.remove(id).then(() => ({ workoutDayId })),
    onSuccess: ({ workoutDayId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.workoutDays.records(workoutDayId) })
    },
  })
}
