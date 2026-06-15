import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useExercises } from '@/queries/useExercises'
import { useExerciseProgress } from '@/queries/useExerciseProgress'
import { PageLayout } from '@/components/PageLayout'

// チャート3系列の色。暖色パレットに馴染む3色（旧 lift_log の配色を踏襲）。
const seriesColor = {
  totalVolume: '#E86029', // accent（オレンジ）
  maxWeight: '#E0A82E', // ゴールド
  oneRM: '#4F86C6', // ブルー
}

// チャートは surface-secondary（暗色）上に描くので、軸/グリッド/文字は明るめに固定する。
const gridColor = 'rgb(80 81 84)' // border-default
const tickColor = 'rgb(241 239 223)' // main（ベージュ）

function formatDate(isoDate: string): string {
  // YYYY-MM-DD → M/D（タイムゾーンの影響を避けるため文字列から直接組む）
  const [, m, d] = isoDate.split('-')
  return `${Number(m)}/${Number(d)}`
}

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

interface TooltipPayloadItem {
  dataKey: string
  name: string
  value: number
  color: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md bg-surface-secondary px-3 py-2 text-xs ring-1 ring-border-default">
      <div className="mb-1 text-content-inverse">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value} kg
        </div>
      ))}
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
      const fromParam = exerciseParam && exercises.some((e) => e.id === exerciseParam)
        ? exerciseParam
        : null
      setSelectedExercise(fromParam ?? exercises[0].id)
    }
  }, [exercises, selectedExercise, exerciseParam])

  const { data: progress, isLoading: progressLoading } = useExerciseProgress(selectedExercise)

  const chartData = useMemo(
    () =>
      (progress?.points ?? []).map((p) => ({
        date: formatDate(p.date),
        totalVolume: p.totalVolume,
        maxWeight: p.maxWeight,
        oneRM: p.estimatedOneRepMax,
      })),
    [progress],
  )

  const axisTick = { fill: tickColor, fontSize: 10 }

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
              {progressLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-content-inverse">読み込み中…</p>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-content-inverse/60">この種目の記録がありません</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={axisTick} stroke={gridColor} />
                    <YAxis
                      yAxisId="volume"
                      orientation="left"
                      tick={axisTick}
                      stroke={gridColor}
                      width={44}
                    />
                    <YAxis
                      yAxisId="weight"
                      orientation="right"
                      tick={axisTick}
                      stroke={gridColor}
                      width={44}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: tickColor, paddingTop: 8 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Line
                      yAxisId="volume"
                      type="monotone"
                      dataKey="totalVolume"
                      name="総ボリューム (kg)"
                      stroke={seriesColor.totalVolume}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      yAxisId="weight"
                      type="monotone"
                      dataKey="maxWeight"
                      name="Max重量 (kg)"
                      stroke={seriesColor.maxWeight}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      yAxisId="weight"
                      type="monotone"
                      dataKey="oneRM"
                      name="推定1RM (kg)"
                      stroke={seriesColor.oneRM}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
