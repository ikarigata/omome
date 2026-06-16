import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useExercises } from '@/queries/useExercises'
import { PageLayout } from '@/components/PageLayout'
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart'

/** 種目選択ドロップダウン。クリック外で閉じる単一選択。 */
function ExerciseDropdown({
  options,
  value,
  onChange,
}: {
  options: { id: string; name: string }[]
  value: string | null
  onChange: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selectedLabel = options.find((o) => o.id === value)?.name ?? '種目を選択'

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md bg-surface-container px-3 py-2 text-left text-content-inverse"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md bg-surface-secondary shadow-lg ring-1 ring-border-default">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id)
                  setIsOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-content-inverse hover:bg-surface-container"
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function StatisticsPage() {
  const { data: exercises, isLoading: exercisesLoading } = useExercises()

  // 入力画面の種目カードから ?exercise=<id> で遷移してきた場合の初期選択。
  const [searchParams] = useSearchParams()
  const exerciseParam = searchParams.get('exercise')

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  // 種目が読み込まれたら初期選択する。クエリで種目が指定され、かつ実在すれば
  // それを優先し、無ければ先頭を選ぶ。
  useEffect(() => {
    if (selectedExercise == null && exercises && exercises.length > 0) {
      const fromParam =
        exerciseParam && exercises.some((e) => e.id === exerciseParam) ? exerciseParam : null
      setSelectedExercise(fromParam ?? exercises[0].id)
    }
  }, [exercises, selectedExercise, exerciseParam])

  return (
    <PageLayout title="統計">
      <div className="space-y-3 p-4">
        {exercisesLoading ? (
          <p className="py-8 text-center text-sm text-content-secondary">読み込み中…</p>
        ) : !exercises || exercises.length === 0 ? (
          <p className="py-8 text-center text-sm text-content-secondary">
            種目がまだありません。種目を登録すると統計を表示できます。
          </p>
        ) : (
          <div className="space-y-3 rounded-xl bg-surface-secondary p-3">
            <ExerciseDropdown
              options={exercises.map((e) => ({ id: e.id, name: e.name }))}
              value={selectedExercise}
              onChange={setSelectedExercise}
            />

            <div className="h-[420px] w-full">
              <ExerciseProgressChart exerciseId={selectedExercise} />
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
