import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exercisesApi } from '@/api/resources/exercises'
import type { ExerciseResponse, ExerciseUpsertRequest, MuscleGroupResponse } from '@/api/types'
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
    // 楽観的更新：作成往復を待たず一覧に即時表示する。クライアント生成 UUID＋
    // 冪等（PK重複→既存返却）なので、先にローカルへ反映してから本送信しても安全。
    onMutate: async (data) => {
      const listKey = queryKeys.exercises.all()
      await qc.cancelQueries({ queryKey: listKey })
      const prev = qc.getQueryData<ExerciseResponse[]>(listKey)

      // 部位名はキャッシュ済みの部位マスタから引く（無ければ空文字でフォールバック）。
      const masters = qc.getQueryData<MuscleGroupResponse[]>(queryKeys.muscleGroups.all()) ?? []
      const nameOf = (id: string) => masters.find((m) => m.id === id)?.name ?? ''
      // 規約どおりメイン（isPrimary）を先頭に並べる。
      const muscleGroups = [...data.muscleGroups]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((g) => ({ id: g.id, name: nameOf(g.id), isPrimary: g.isPrimary }))

      const now = new Date().toISOString()
      const optimistic: ExerciseResponse = {
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        muscleGroups,
        createdAt: now,
        updatedAt: now,
      }
      qc.setQueryData<ExerciseResponse[]>(listKey, (old) => {
        if (!old) return old
        if (old.some((e) => e.id === data.id)) return old
        return [...old, optimistic]
      })

      return { listKey, prev }
    },
    onError: (_err, _data, ctx) => {
      // 失敗したら楽観挿入を巻き戻す（自動リトライはしない）。
      if (ctx?.prev) qc.setQueryData(ctx.listKey, ctx.prev)
    },
    onSuccess: (res) => {
      // 楽観行をサーバの実レコードで置換する（id は同一なので重複しない）。
      qc.setQueryData<ExerciseResponse[]>(queryKeys.exercises.all(), (old) => {
        if (!old) return old
        return old.some((e) => e.id === res.id)
          ? old.map((e) => (e.id === res.id ? res : e))
          : [...old, res]
      })
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
