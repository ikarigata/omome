import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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
import { useWorkoutRecordsByDay } from '@/queries/useWorkoutRecords'
import { useWorkoutSets, useCreateWorkoutSet, useUpdateWorkoutSet, useDeleteWorkoutSet } from '@/queries/useWorkoutSets'
import { useExercise } from '@/queries/useExercises'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/Button'
import { generateId } from '@/lib/uuid'
import { calcVolume, calcRM } from '@/lib/exercise'
import type { WorkoutSetResponse } from '@/api/types'

interface SetRow {
  id: string
  reps: number
  subReps: number
  weight: number
  isNew?: boolean
}

function SortableSetRow({
  setRow,
  index,
  onUpdate,
  onDelete,
  isPending,
}: {
  setRow: SetRow
  index: number
  onUpdate: (id: string, field: keyof Pick<SetRow, 'reps' | 'subReps' | 'weight'>, value: number) => void
  onDelete: (id: string) => void
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
      <div className="flex gap-4 pl-8 text-xs text-content-inverse/50">
        <span>ボリューム: {volume} kg</span>
        <span>1RM推定: {rm} kg</span>
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

export function SetInputPage() {
  const { workoutId, exerciseId } = useParams<{ workoutId: string; exerciseId: string }>()

  const { data: records = [] } = useWorkoutRecordsByDay(workoutId ?? '')
  const record = records.find((r) => r.exerciseId === exerciseId)

  const { data: sets } = useWorkoutSets(record?.id ?? '')
  const { data: exercise } = useExercise(exerciseId ?? '')

  const createSet = useCreateWorkoutSet()
  const updateSet = useUpdateWorkoutSet()
  const deleteSet = useDeleteWorkoutSet()

  const [rows, setRows] = useState<SetRow[]>([])
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  // sets はロード中 undefined（安定参照）。`= []` 既定だと毎レンダ新しい配列になり
  // この effect が無限ループするため、依存は素の `sets` にして中で空配列にフォールバックする。
  useEffect(() => {
    setRows(setsToRows(sets ?? []))
  }, [sets])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleAddSet() {
    if (!record?.id) return
    const id = generateId()
    const newRow: SetRow = { id, reps: 0, subReps: 0, weight: 0, isNew: true }

    setRows((prev) => {
      const last = prev[prev.length - 1]
      if (last) {
        return [...prev, { id, reps: last.reps, subReps: last.subReps, weight: last.weight }]
      }
      return [...prev, newRow]
    })

    setPendingIds((s) => new Set(s).add(id))
    try {
      const row = rows[rows.length - 1]
      await createSet.mutateAsync({
        workoutRecordId: record.id,
        data: {
          id,
          reps: row?.reps ?? 0,
          subReps: row?.subReps ?? 0,
          weight: row?.weight ?? 0,
        },
      })
    } finally {
      setPendingIds((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  function handleUpdateLocal(id: string, field: keyof Pick<SetRow, 'reps' | 'subReps' | 'weight'>, value: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  async function handleBlurUpdate(id: string) {
    if (!record?.id) return
    const row = rows.find((r) => r.id === id)
    if (!row) return
    await updateSet.mutateAsync({
      id,
      workoutRecordId: record.id,
      data: { reps: row.reps, subReps: row.subReps, weight: row.weight },
    })
  }

  async function handleDelete(id: string) {
    if (!record?.id) return
    setRows((prev) => prev.filter((r) => r.id !== id))
    await deleteSet.mutateAsync({ id, workoutRecordId: record.id })
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
  const isPending = createSet.isPending || updateSet.isPending || deleteSet.isPending

  return (
    <PageLayout title={exercise?.name ?? 'セット入力'}>
      <div className="p-4 space-y-4">
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
                onBlur={() => void handleBlurUpdate(row.id)}
              >
                <SortableSetRow
                  setRow={row}
                  index={i}
                  onUpdate={handleUpdateLocal}
                  onDelete={(id) => void handleDelete(id)}
                  isPending={isPending || pendingIds.has(row.id)}
                />
              </div>
            ))}
          </SortableContext>
        </DndContext>

        {rows.length === 0 && !record && (
          <p className="text-center text-content-secondary text-sm py-4">
            セットを追加してください
          </p>
        )}

        <Button
          onClick={() => void handleAddSet()}
          disabled={!record?.id || createSet.isPending}
          className="w-full"
        >
          ＋ セットを追加
        </Button>
      </div>
    </PageLayout>
  )
}
