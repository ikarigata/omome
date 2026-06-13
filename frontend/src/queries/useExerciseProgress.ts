import { useQuery } from '@tanstack/react-query'
import { exercisesApi } from '@/api/resources/exercises'
import { queryKeys } from './queryKeys'

// 統計画面用：種目の進捗（セッション単位の集約）を取得する。
// 集約はバックエンドの GET /exercises/:id/progress が担う。
export function useExerciseProgress(exerciseId: string | null) {
  return useQuery({
    queryKey: queryKeys.exercises.progress(exerciseId ?? ''),
    queryFn: () => exercisesApi.progress(exerciseId!),
    enabled: !!exerciseId,
  })
}
