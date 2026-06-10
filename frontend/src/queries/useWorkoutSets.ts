import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutSetsApi } from '@/api/resources/workoutSets'
import type { WorkoutSetCreateRequest, WorkoutSetResponse, WorkoutSetUpdateRequest } from '@/api/types'
import { queryKeys } from './queryKeys'

export function useWorkoutSets(workoutRecordId: string) {
  return useQuery({
    queryKey: queryKeys.workoutRecords.sets(workoutRecordId),
    queryFn: () => workoutSetsApi.listByRecord(workoutRecordId),
    enabled: !!workoutRecordId,
  })
}

// 書き込み後は再フェッチせず、返ってきた行でキャッシュを直接更新する（越境往復を増やさない）。
// 画面表示は ExerciseSetEditor のローカル state が担うので、ここはキャッシュ整合のためだけ。
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
      qc.setQueryData<WorkoutSetResponse[]>(
        queryKeys.workoutRecords.sets(res.workoutRecordId),
        (old) => {
          if (!old) return old
          // 冪等（PK重複→既存返却）なので既存があれば置換、なければ追加。
          return old.some((s) => s.id === res.id)
            ? old.map((s) => (s.id === res.id ? res : s))
            : [...old, res]
        },
      )
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
    onSuccess: (res) => {
      qc.setQueryData<WorkoutSetResponse[]>(
        queryKeys.workoutRecords.sets(res.workoutRecordId),
        (old) => old?.map((s) => (s.id === res.id ? res : s)),
      )
    },
  })
}

export function useDeleteWorkoutSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, workoutRecordId }: { id: string; workoutRecordId: string }) =>
      workoutSetsApi.remove(id).then(() => ({ id, workoutRecordId })),
    onSuccess: ({ id, workoutRecordId }) => {
      qc.setQueryData<WorkoutSetResponse[]>(
        queryKeys.workoutRecords.sets(workoutRecordId),
        (old) => old?.filter((s) => s.id !== id),
      )
    },
  })
}
