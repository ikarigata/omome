import { useNavigate } from 'react-router-dom'
import { useWorkoutDays } from '@/queries/useWorkoutDays'
import { useMe } from '@/queries/useMe'
import { PageLayout } from '@/components/PageLayout'
import { formatDateJa, getDayOfWeekJa } from '@/lib/date'

export function HomePage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: days, isLoading } = useWorkoutDays()

  const sorted = days ? [...days].sort((a, b) => b.date.localeCompare(a.date)) : []

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
            {day.title && <p className="font-bold">{day.title}</p>}
            {!day.title && <p className="font-bold text-content-inverse/40">タイトルなし</p>}
            {day.notes && <p className="text-sm text-content-inverse/60">{day.notes}</p>}
          </button>
        ))}
      </div>
    </PageLayout>
  )
}
