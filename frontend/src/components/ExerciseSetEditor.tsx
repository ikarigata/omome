import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWorkoutSets, useCreateWorkoutSet, useUpdateWorkoutSet, useDeleteWorkoutSet } from '@/queries/useWorkoutSets'
import { Button } from '@/components/Button'
import { generateId } from '@/lib/uuid'
import { calcVolume, calcRM } from '@/lib/exercise'
import type { WorkoutSetResponse } from '@/api/types'

interface SetRow {
  id: string
  reps: number
  subReps: number
  weight: number
}

// 行ごとの保存状態。undefined = 保存済み（クリーン）。
type SaveStatus = 'saving' | 'error'

function SortableSetRow({
  setRow,
  index,
  status,
  onUpdate,
  onDelete,
  onRetry,
  isPending,
}: {
  setRow: SetRow
  index: number
  status?: SaveStatus
  onUpdate: (id: string, field: keyof Pick<SetRow, 'reps' | 'subReps' | 'weight'>, value: number) => void
  onDelete: (id: string) => void
  onRetry: (id: string) => void
  isPending: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: setRow.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const volume = calcVolume(setRow.reps, setRow.subReps, setRow.weight)
  const rm = calcRM(setRow.reps, setRow.weight)

  return (
    <div ref={setNodeRef} style={style} className="bg-surface-container rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-content-inverse/30 cursor-grab active:cursor-grabbing px-1"
        >
          ⠿
        </button>
        <span className="text-content-inverse/60 text-sm w-5">{index + 1}</span>
        <div className="flex-1 grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-content-inverse/50">レップ</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={setRow.reps}
              onChange={(e) => onUpdate(setRow.id, 'reps', Number(e.target.value))}
              className="w-full bg-surface-secondary text-content-inverse rounded px-2 py-1 text-center text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-content-inverse/50">追加レップ</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={setRow.subReps}
              onChange={(e) => onUpdate(setRow.id, 'subReps', Number(e.target.value))}
              className="w-full bg-surface-secondary text-content-inverse rounded px-2 py-1 text-center text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-content-inverse/50">重量 (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={setRow.weight}
              onChange={(e) => onUpdate(setRow.id, 'weight', Number(e.target.value))}
              className="w-full bg-surface-secondary text-content-inverse rounded px-2 py-1 text-center text-sm"
            />
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(setRow.id)}
          disabled={isPending}
          className="shrink-0"
        >
          ✕
        </Button>
      </div>
      <div className="flex items-center gap-4 pl-8 text-xs text-content-inverse/50">
        <span>ボリューム: {volume} kg</span>
        <span>1RM推定: {rm} kg</span>
        {status === 'saving' && <span className="text-content-inverse/40">保存中…</span>}
        {status === 'error' && (
          <span className="ml-auto flex items-center gap-2 text-danger">
            保存に失敗しました
            <button
              type="button"
              onClick={() => onRetry(setRow.id)}
              className="underline hover:opacity-80"
            >
              再試行
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

function setsToRows(sets: WorkoutSetResponse[]): SetRow[] {
  return sets.map((s) => ({
    id: s.id,
    reps: s.reps,
    subReps: s.subReps,
    weight: s.weight,
  }))
}

export function ExerciseSetEditor({ workoutRecordId }: { workoutRecordId: string }) {
  const { data: sets } = useWorkoutSets(workoutRecordId)

  const createSet = useCreateWorkoutSet()
  const updateSet = useUpdateWorkoutSet()
  const deleteSet = useDeleteWorkoutSet()

  const [rows, setRows] = useState<SetRow[]>([])
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  // 失敗した操作の再実行クロージャ（再試行ボタン用）。自動リトライはしない。
  const retryFns = useRef<Record<string, () => void>>({})

  // サーバ値はマウント時の初期種付けにだけ使う。以降はローカル rows が真実なので
  // 上書き同期しない（編集中の値が保存完了の再描画で巻き戻るのを防ぐ）。
  const seeded = useRef(false)
  useEffect(() => {
    if (!seeded.current && sets) {
      setRows(setsToRows(sets))
      seeded.current = true
    }
  }, [sets])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 1行分の保存を実行。失敗しても値は保持し、再試行できるよう action を覚えておく。
  async function save(id: string, action: () => Promise<unknown>) {
    setSaveStatus((s) => ({ ...s, [id]: 'saving' }))
    try {
      await action()
      setSaveStatus((s) => {
        const next = { ...s }
        delete next[id]
        return next
      })
      delete retryFns.current[id]
    } catch {
      // 自動リトライはしない（コスト回避）。ユーザーが再試行ボタンを押したときだけ再送。
      retryFns.current[id] = () => void save(id, action)
      setSaveStatus((s) => ({ ...s, [id]: 'error' }))
    }
  }

  function handleAddSet() {
    if (!workoutRecordId) return
    const id = generateId()
    const last = rows[rows.length - 1]
    const values = last
      ? { reps: last.reps, subReps: last.subReps, weight: last.weight }
      : { reps: 0, subReps: 0, weight: 0 }

    setRows((prev) => [...prev, { id, ...values }])
    void save(id, () => createSet.mutateAsync({ workoutRecordId, data: { id, ...values } }))
  }

  function handleUpdateLocal(id: string, field: keyof Pick<SetRow, 'reps' | 'subReps' | 'weight'>, value: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  function handleBlurUpdate(id: string) {
    if (!workoutRecordId) return
    const row = rows.find((r) => r.id === id)
    if (!row) return
    // まだ作成が完了していない行は update せず作成（再試行）に任せる。
    const saved = sets?.find((s) => s.id === id)
    if (!saved) return
    // 値が変わっていなければ無駄な書き込みをしない。
    if (saved.reps === row.reps && saved.subReps === row.subReps && saved.weight === row.weight) return

    const data = { reps: row.reps, subReps: row.subReps, weight: row.weight }
    void save(id, () => updateSet.mutateAsync({ id, workoutRecordId, data }))
  }

  function handleDelete(id: string) {
    if (!workoutRecordId) return
    // 削除は確定してから行を消す（失敗時に行を残して再試行できるように）。
    void save(id, async () => {
      await deleteSet.mutateAsync({ id, workoutRecordId })
      setRows((prev) => prev.filter((r) => r.id !== id))
    })
  }

  function handleRetry(id: string) {
    retryFns.current[id]?.()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id)
      const newIndex = prev.findIndex((r) => r.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const totalVolume = rows.reduce((sum, r) => sum + calcVolume(r.reps, r.subReps, r.weight), 0)

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="text-sm text-content-secondary text-right">
          総ボリューム: {totalVolume} kg
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {rows.map((row, i) => (
            <div
              key={row.id}
              onBlur={() => handleBlurUpdate(row.id)}
            >
              <SortableSetRow
                setRow={row}
                index={i}
                status={saveStatus[row.id]}
                onUpdate={handleUpdateLocal}
                onDelete={handleDelete}
                onRetry={handleRetry}
                isPending={saveStatus[row.id] === 'saving'}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <Button
        onClick={handleAddSet}
        disabled={!workoutRecordId}
        className="w-full"
        variant="secondary"
        size="sm"
      >
        ＋ セットを追加
      </Button>
    </div>
  )
}
