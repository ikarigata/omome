import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workoutRecordsApi } from '@/api/resources/workoutRecords'
import type {
  WorkoutRecordResponse,
  WorkoutRecordUpsertRequest,
  WorkoutSetResponse,
} from '@/api/types'
import { queryKeys } from './queryKeys'
import { invalidateExerciseAggregates } from './invalidateExerciseAggregates'

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
    // 楽観的更新：作成往復を待たずにカードと最初の入力行を即時表示する。
    // クライアント生成 UUID＋冪等（PK重複→既存返却）なので、先にローカルへ
    // 反映してから本送信しても安全。
    onMutate: async (data) => {
      const recordsKey = queryKeys.workoutDays.records(data.workoutDayId)
      await qc.cancelQueries({ queryKey: recordsKey })
      const prevRecords = qc.getQueryData<WorkoutRecordResponse[]>(recordsKey)

      const now = new Date().toISOString()
      const optimistic: WorkoutRecordResponse = {
        id: data.id,
        workoutDayId: data.workoutDayId,
        exerciseId: data.exerciseId,
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
      }
      qc.setQueryData<WorkoutRecordResponse[]>(recordsKey, (old) => {
        if (!old) return old
        // 同じ id / 同じ種目が既にあれば二重に足さない。
        if (old.some((r) => r.id === data.id || r.exerciseId === data.exerciseId)) return old
        return [...old, optimistic]
      })

      // 新レコードの sets を空でシード。これで ExerciseSetEditor がマウント時点で
      // 「sets は空」と分かり、取得往復を待たずに autoStart が最初の行を作れる。
      const setsKey = queryKeys.workoutRecords.sets(data.id)
      const hadSets = qc.getQueryData<WorkoutSetResponse[]>(setsKey) !== undefined
      if (!hadSets) qc.setQueryData<WorkoutSetResponse[]>(setsKey, [])

      return { recordsKey, prevRecords, setsKey, hadSets }
    },
    onError: (_err, _data, ctx) => {
      if (!ctx) return
      // 失敗したら楽観挿入を巻き戻す（自動リトライはしない）。
      if (ctx.prevRecords) qc.setQueryData(ctx.recordsKey, ctx.prevRecords)
      if (!ctx.hadSets) qc.removeQueries({ queryKey: ctx.setsKey })
    },
    onSuccess: (res, variables) => {
      // 楽観挿入した仮レコードを除き、サーバの実レコードで upsert する。
      // 冪等合流で id が変わるケースでも重複しない。再フェッチは挟まない。
      qc.setQueryData<WorkoutRecordResponse[]>(
        queryKeys.workoutDays.records(res.workoutDayId),
        (old) => {
          if (!old) return old
          const cleaned = old.filter((r) => r.id !== variables.id)
          return cleaned.some((r) => r.id === res.id)
            ? cleaned.map((r) => (r.id === res.id ? res : r))
            : [...cleaned, res]
        },
      )
      invalidateExerciseAggregates(qc)
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
      invalidateExerciseAggregates(qc)
    },
  })
}
