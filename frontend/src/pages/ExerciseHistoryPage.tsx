import { useNavigate, useParams } from 'react-router-dom'
import { useExercise } from '@/queries/useExercises'
import { useExerciseHistory } from '@/queries/useExerciseHistory'
import { PageLayout } from '@/components/PageLayout'
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart'
import { calcVolume } from '@/lib/exercise'
import { formatDateJa, getDayOfWeekJa } from '@/lib/date'

// 種目の履歴と統計をまとめて見る画面。上半分に直近5回の履歴一覧（スクロール可）、
// 下半分に同じ種目の統計グラフを表示する。入力画面の種目カードの「履歴」ボタンから
// 遷移する。ボトムナビには出さない。
export function ExerciseHistoryPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()

  const { data: exercise } = useExercise(exerciseId ?? '')
  const { data: history, isLoading } = useExerciseHistory(exerciseId ?? null)

  const sessions = history?.sessions ?? []
  const hasRecords = sessions.length > 0

  return (
    <PageLayout title="履歴・統計" hideNav>
      <div className="flex flex-col gap-3 p-4 pb-24">
        {exercise && (
          <p className="text-sm text-content-secondary">
            {exercise.name}
            {hasRecords && `・直近${sessions.length}回`}
          </p>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-content-secondary">読み込み中…</p>
        ) : !hasRecords ? (
          <p className="py-8 text-center text-sm text-content-secondary">
            この種目の記録がありません
          </p>
        ) : (
          <>
            {/* 上半分：履歴一覧。件数が多くて収まらない場合はここだけスクロールする
                （下のグラフは常に見える）。 */}
            <div className="max-h-[46dvh] space-y-3 overflow-y-auto">
              {sessions.map((session) => {
                const totalVolume = session.sets.reduce(
                  (sum, s) => sum + calcVolume(s.reps, s.weight),
                  0,
                )
                return (
                  <div
                    key={session.workoutDayId}
                    className="rounded-xl bg-surface-secondary px-4 py-3"
                  >
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
              })}
            </div>

            {/* 下半分：同じ種目の統計グラフ。recharts はチャンク分割される（Statistics
                と共有）。 */}
            <div className="h-[40dvh] min-h-[260px] w-full rounded-xl bg-surface-secondary p-3">
              <ExerciseProgressChart exerciseId={exerciseId ?? null} />
            </div>
          </>
        )}
      </div>

      {/* 「少し見て戻る」操作が多い画面なので、戻る導線は親指が届く最下部中央に
          フロート表示する。見つけやすさ重視で塗り＋影の目立つピル型にする。
          safe-area 分を底上げしてホームバー等と重ならないようにする。 */}
      <button
        type="button"
        aria-label="戻る"
        onClick={() => navigate(-1)}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-interactive-primary px-8 py-3.5 text-base font-bold text-content-inverse shadow-lg transition-all hover:bg-interactive-hover active:scale-95"
      >
        <span aria-hidden>←</span>
        戻る
      </button>
    </PageLayout>
  )
}
