import { useNavigate, useParams } from 'react-router-dom'
import { useExercise } from '@/queries/useExercises'
import { useExerciseHistory } from '@/queries/useExerciseHistory'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/Button'
import { calcVolume } from '@/lib/exercise'
import { formatDateJa, getDayOfWeekJa } from '@/lib/date'

// 種目の直近トレーニング履歴（直近5回）を閲覧専用で一覧表示する。
// 入力画面の種目カードの「履歴」ボタンから遷移する。ボトムナビには出さない。
export function ExerciseHistoryPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()

  const { data: exercise } = useExercise(exerciseId ?? '')
  const { data: history, isLoading } = useExerciseHistory(exerciseId ?? null)

  const sessions = history?.sessions ?? []

  return (
    <PageLayout
      title="履歴"
      hideNav
      headerRight={
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          戻る
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        {exercise && (
          <p className="text-sm text-content-secondary">
            {exercise.name}
            {sessions.length > 0 && `・直近${sessions.length}回`}
          </p>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-content-secondary">読み込み中…</p>
        ) : sessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-content-secondary">
            この種目の記録がありません
          </p>
        ) : (
          sessions.map((session) => {
            const totalVolume = session.sets.reduce(
              (sum, s) => sum + calcVolume(s.reps, s.weight),
              0,
            )
            return (
              <div key={session.workoutDayId} className="rounded-xl bg-surface-secondary px-4 py-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-bold text-content-inverse">
                    {formatDateJa(session.date)}（{getDayOfWeekJa(session.date)}）
                  </span>
                  <span className="text-xs text-content-inverse/50">計 {totalVolume} kg</span>
                </div>
                <div className="space-y-1">
                  {session.sets.map((set, i) => (
                    <div
                      key={set.id}
                      className="flex items-center gap-3 text-sm text-content-inverse"
                    >
                      <span className="w-4 text-content-inverse/50">{i + 1}</span>
                      <span className="tabular-nums">{set.weight} kg</span>
                      <span className="text-content-inverse/40">×</span>
                      <span className="tabular-nums">{set.reps} 回</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </PageLayout>
  )
}
