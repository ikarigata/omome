import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutSetsApi } from '@/api/resources/workoutSets'
import type { WorkoutSetCreateRequest, WorkoutSetResponse, WorkoutSetUpdateRequest } from '@/api/types'
import { queryKeys } from './queryKeys'
import { invalidateExerciseAggregates } from './invalidateExerciseAggregates'

// useWorkoutSets と、ページ側でまとめて先読みする useQueries の双方で同じ設定を使う。
// staleTime を持たせることで、先読み済みのキャッシュをエディタがマウントしても
// 再フェッチしない（書き込みは setQueryData でキャッシュを直接更新するため再取得不要）。
export function workoutSetsQueryOptions(workoutRecordId: string) {
  return {
    queryKey: queryKeys.workoutRecords.sets(workoutRecordId),
    queryFn: () => workoutSetsApi.listByRecord(workoutRecordId),
    enabled: !!workoutRecordId,
    staleTime: 60_000,
  }
}

export function useWorkoutSets(workoutRecordId: string) {
  return useQuery(workoutSetsQueryOptions(workoutRecordId))
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
      invalidateExerciseAggregates(qc)
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
      invalidateExerciseAggregates(qc)
    },
  })
}

// セットの並べ替えを永続化する。表示は ExerciseSetEditor のローカル state が
// 即時に反映するので、ここは成功時に返ってきた並び順でキャッシュを揃えるだけ。
export function useReorderWorkoutSets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workoutRecordId, ids }: { workoutRecordId: string; ids: string[] }) =>
      workoutSetsApi.reorder(workoutRecordId, ids),
    onSuccess: (res, { workoutRecordId }) => {
      qc.setQueryData<WorkoutSetResponse[]>(queryKeys.workoutRecords.sets(workoutRecordId), res)
      invalidateExerciseAggregates(qc)
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
      invalidateExerciseAggregates(qc)
    },
  })
}
