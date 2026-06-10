import { useNavigate } from 'react-router-dom'
import { useWorkoutDays, useCreateWorkoutDay } from '@/queries/useWorkoutDays'
import { useMe } from '@/queries/useMe'
import { PageLayout } from '@/components/PageLayout'
import { formatDateJa, getDayOfWeekJa, todayString } from '@/lib/date'
import { generateId } from '@/lib/uuid'

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-12">
      <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: days, isLoading } = useWorkoutDays()
  const createDay = useCreateWorkoutDay()

  const sorted = days ? [...days].sort((a, b) => b.date.localeCompare(a.date)) : []

  // トレーニングは1日1登録。同じ日が既にあればその画面へ、なければ作成して遷移する。
  async function handlePlusClick() {
    const today = todayString()
    const existing = days?.find((d) => d.date === today)
    if (existing) {
      navigate(`/workout/${existing.id}`)
      return
    }
    const result = await createDay.mutateAsync({
      id: generateId(),
      date: today,
    })
    navigate(`/workout/${result.id}`)
  }

  return (
    <PageLayout title={me ? `${me.name} のトレーニング` : 'omome'}>
      <div className="p-4 space-y-3">
        {isLoading && (
          <p className="text-center text-content-secondary text-sm py-8">読み込み中…</p>
        )}
        {!isLoading && sorted.length === 0 && (
          <p className="text-center text-content-secondary text-sm py-8">
            下の＋ボタンで今日のトレーニングを始めよう
          </p>
        )}
        {sorted.map((day) => (
          <button
            key={day.id}
            onClick={() => navigate(`/workout/${day.id}`)}
            className="w-full text-left bg-surface-secondary text-content-inverse rounded-xl p-4 space-y-1 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-content-inverse/60">
                {formatDateJa(day.date)}（{getDayOfWeekJa(day.date)}）
              </span>
            </div>
            {day.notes && <p className="text-sm text-content-inverse/60">{day.notes}</p>}
            {day.muscleGroups && day.muscleGroups.length > 0 && (
              <div className="flex flex-wrap justify-start gap-2 pt-1">
                {day.muscleGroups.map((mg) => (
                  <span
                    key={mg}
                    className="bg-surface-container text-content-inverse/80 text-sm rounded-md px-2.5 py-1"
                  >
                    {mg}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-0 z-20 pointer-events-none">
        <div className="max-w-md mx-auto px-4 flex justify-end">
          <button
            onClick={() => void handlePlusClick()}
            disabled={createDay.isPending}
            aria-label="今日のトレーニングを追加"
            className="pointer-events-auto flex items-center justify-center size-[5.25rem] rounded-2xl bg-interactive-primary text-content-inverse shadow-lg hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </PageLayout>
  )
}
