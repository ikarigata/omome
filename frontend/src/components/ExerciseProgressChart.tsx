import { useMemo } from 'react'
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
import { useExerciseProgress } from '@/queries/useExerciseProgress'

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

// 種目の進捗（総ボリューム / Max重量 / 推定1RM の推移）を recharts で描く。
// 親要素の高さいっぱいに広がる（ResponsiveContainer）。recharts は重いので
// 呼び出し側で遅延読み込み（React.lazy）して本体バンドルから切り離す。
export function ExerciseProgressChart({ exerciseId }: { exerciseId: string | null }) {
  const { data: progress, isLoading } = useExerciseProgress(exerciseId)

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-content-inverse">読み込み中…</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-content-inverse/60">この種目の記録がありません</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={axisTick} stroke={gridColor} />
        <YAxis yAxisId="volume" orientation="left" tick={axisTick} stroke={gridColor} width={44} />
        <YAxis yAxisId="weight" orientation="right" tick={axisTick} stroke={gridColor} width={44} />
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
  )
}
