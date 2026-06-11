import { useMemo, useState } from 'react'
import type { ExerciseResponse } from '@/api/types'
import { useMuscleGroups } from '@/queries/useMuscleGroups'
import { getPrimaryMuscleGroup } from '@/lib/exercise'

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-sm transition-all ${
        active
          ? 'bg-interactive-primary text-content-inverse'
          : 'bg-surface-container text-content-inverse opacity-50'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * 種目選択ドロップダウン。
 *
 * トレーニング日ページの「種目を追加」ボタンの位置にインラインで開く想定。
 * ナビゲーション遷移を伴わず、選択された種目を `onSelect` で親へ返すだけの
 * 表示専用コンポーネント（記録の作成は親が担う）。
 *
 * 上部に部位フィルタータブを持つ。タブは「すべて」＋選択肢に出ている種目が
 * 実際に持つ部位だけを部位マスタ順で並べる単一選択。
 *
 * 部位マスタが届くまではタブもリストも描画しない。タブだけ後から差し込まれて
 * リストが下にずれるのを防ぐため、揃ってからタブとリストを一緒に出す
 * （親側で部位マスタを先読みしていれば、この待ちは実質発生しない）。
 */
export function ExerciseSelect({
  available,
  onSelect,
  onClose,
  isPending = false,
}: {
  available: ExerciseResponse[]
  onSelect: (exerciseId: string) => void
  onClose: () => void
  isPending?: boolean
}) {
  const { data: allMuscleGroups = [], isLoading: groupsLoading } = useMuscleGroups()

  // null = 「すべて」。それ以外は部位 id。
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // 選択肢に出ている種目が実際に持つ部位だけを、部位マスタの順序でタブ化する。
  const filterGroups = useMemo(() => {
    const present = new Set(available.flatMap((e) => e.muscleGroups.map((g) => g.id)))
    return allMuscleGroups.filter((mg) => present.has(mg.id))
  }, [available, allMuscleGroups])

  const filtered = useMemo(
    () =>
      selectedGroupId == null
        ? available
        : available.filter((e) => e.muscleGroups.some((g) => g.id === selectedGroupId)),
    [available, selectedGroupId],
  )

  return (
    <div className="bg-surface-secondary rounded-xl p-2 space-y-2">
      <div className="flex items-center justify-between px-2 pt-1">
        <span className="text-sm font-bold text-content-inverse">種目を選択</span>
        <button
          type="button"
          onClick={onClose}
          className="text-content-inverse/60 text-sm hover:opacity-80 px-2 py-1"
        >
          閉じる
        </button>
      </div>

      {groupsLoading ? (
        <p className="text-center text-content-inverse/60 text-sm py-6">読み込み中…</p>
      ) : (
        <>
          {filterGroups.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-2 pb-1">
              <FilterTab
                label="すべて"
                active={selectedGroupId == null}
                onClick={() => setSelectedGroupId(null)}
              />
              {filterGroups.map((mg) => (
                <FilterTab
                  key={mg.id}
                  label={mg.name}
                  active={selectedGroupId === mg.id}
                  onClick={() => setSelectedGroupId(mg.id)}
                />
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-center text-content-inverse/60 text-sm py-6">
                追加できる種目がありません
              </p>
            ) : (
              filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => onSelect(exercise.id)}
                  disabled={isPending}
                  className="w-full text-left bg-surface-container text-content-inverse rounded-lg p-3 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  <p className="font-bold">{exercise.name}</p>
                  <p className="text-sm text-content-inverse/60">
                    {getPrimaryMuscleGroup(exercise)?.name}
                    {exercise.muscleGroups.length > 1 && ` 他${exercise.muscleGroups.length - 1}部位`}
                  </p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
