import { useQuery } from '@tanstack/react-query'
import { exercisesApi } from '@/api/resources/exercises'
import { queryKeys } from './queryKeys'

// 履歴画面用：種目の直近セッション（セット内訳つき、閲覧専用）を取得する。
// 直近 N 件への絞り込みはバックエンドの GET /exercises/:id/history が担う。
export function useExerciseHistory(exerciseId: string | null) {
  return useQuery({
    queryKey: queryKeys.exercises.history(exerciseId ?? ''),
    queryFn: () => exercisesApi.history(exerciseId!),
    enabled: !!exerciseId,
  })
}
