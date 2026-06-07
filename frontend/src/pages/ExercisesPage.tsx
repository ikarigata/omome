import { useState } from 'react'
import { useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise } from '@/queries/useExercises'
import { useMuscleGroups } from '@/queries/useMuscleGroups'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { ErrorMessage } from '@/components/ErrorMessage'
import { generateId } from '@/lib/uuid'
import { getPrimaryMuscleGroup } from '@/lib/exercise'
import type { ExerciseResponse, MuscleGroupResponse } from '@/api/types'

interface MuscleGroupFormEntry {
  id: string
  isPrimary: boolean
}

interface ExerciseFormState {
  name: string
  description: string
  muscleGroups: MuscleGroupFormEntry[]
}

function ExerciseForm({
  initial,
  muscleGroups,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  initial?: ExerciseFormState
  muscleGroups: MuscleGroupResponse[]
  onSave: (state: ExerciseFormState) => void
  onCancel: () => void
  isPending: boolean
  error?: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [selected, setSelected] = useState<MuscleGroupFormEntry[]>(initial?.muscleGroups ?? [])
  const [validationError, setValidationError] = useState('')

  function toggleMuscleGroup(id: string) {
    setSelected((prev) => {
      const exists = prev.find((g) => g.id === id)
      if (exists) return prev.filter((g) => g.id !== id)
      return [...prev, { id, isPrimary: prev.length === 0 }]
    })
  }

  function setPrimary(id: string) {
    setSelected((prev) => prev.map((g) => ({ ...g, isPrimary: g.id === id })))
  }

  function handleSubmit() {
    if (!name.trim()) {
      setValidationError('種目名を入力してください')
      return
    }
    if (selected.length === 0) {
      setValidationError('部位を1つ以上選択してください')
      return
    }
    const primaryCount = selected.filter((g) => g.isPrimary).length
    if (primaryCount !== 1) {
      setValidationError('メイン部位をちょうど1つ選択してください')
      return
    }
    setValidationError('')
    onSave({ name: name.trim(), description: description.trim(), muscleGroups: selected })
  }

  return (
    <div className="space-y-4">
      <Input
        label="種目名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ベンチプレス"
      />
      <Input
        label="説明（任意）"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="フラットベンチで行う基本種目"
      />

      <div>
        <p className="text-sm text-content-secondary mb-2">部位（タップで選択、★でメイン指定）</p>
        <div className="flex flex-wrap gap-2">
          {muscleGroups.map((mg) => {
            const sel = selected.find((g) => g.id === mg.id)
            return (
              <div key={mg.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleMuscleGroup(mg.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-all ${
                    sel
                      ? 'bg-interactive-primary text-content-inverse'
                      : 'bg-surface-container text-content-inverse opacity-50'
                  }`}
                >
                  {mg.name}
                </button>
                {sel && (
                  <button
                    type="button"
                    onClick={() => setPrimary(mg.id)}
                    className={`text-sm ${sel.isPrimary ? 'text-content-accent' : 'text-content-inverse/30'}`}
                    title="メイン部位に設定"
                  >
                    ★
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <ErrorMessage message={validationError || error} />

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          キャンセル
        </Button>
        <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
          {isPending ? '保存中…' : '保存'}
        </Button>
      </div>
    </div>
  )
}

export function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises()
  const { data: muscleGroups = [] } = useMuscleGroups()
  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const deleteExercise = useDeleteExercise()

  const [showCreate, setShowCreate] = useState(false)
  const [editingExercise, setEditingExercise] = useState<ExerciseResponse | null>(null)

  async function handleCreate(state: ExerciseFormState) {
    await createExercise.mutateAsync({
      id: generateId(),
      name: state.name,
      description: state.description || undefined,
      muscleGroups: state.muscleGroups,
    })
    setShowCreate(false)
  }

  async function handleUpdate(state: ExerciseFormState) {
    if (!editingExercise) return
    await updateExercise.mutateAsync({
      id: editingExercise.id,
      data: {
        id: editingExercise.id,
        name: state.name,
        description: state.description || undefined,
        muscleGroups: state.muscleGroups,
      },
    })
    setEditingExercise(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('この種目を削除しますか？')) return
    await deleteExercise.mutateAsync(id)
  }

  return (
    <PageLayout title="種目管理">
      <div className="p-4 space-y-4">
        {!showCreate && !editingExercise && (
          <Button onClick={() => setShowCreate(true)} className="w-full">
            ＋ 種目を追加
          </Button>
        )}

        {showCreate && (
          <div className="bg-surface-secondary rounded-xl p-4 space-y-4">
            <h2 className="font-bold text-content-inverse">新規種目</h2>
            <ExerciseForm
              muscleGroups={muscleGroups}
              onSave={(s) => void handleCreate(s)}
              onCancel={() => setShowCreate(false)}
              isPending={createExercise.isPending}
              error={createExercise.error?.message}
            />
          </div>
        )}

        {isLoading && (
          <p className="text-center text-content-secondary text-sm py-8">読み込み中…</p>
        )}

        {exercises?.map((exercise) =>
          editingExercise?.id === exercise.id ? (
            <div key={exercise.id} className="bg-surface-secondary rounded-xl p-4 space-y-4">
              <h2 className="font-bold text-content-inverse">種目を編集</h2>
              <ExerciseForm
                initial={{
                  name: exercise.name,
                  description: exercise.description ?? '',
                  muscleGroups: exercise.muscleGroups.map((g) => ({ id: g.id, isPrimary: g.isPrimary })),
                }}
                muscleGroups={muscleGroups}
                onSave={(s) => void handleUpdate(s)}
                onCancel={() => setEditingExercise(null)}
                isPending={updateExercise.isPending}
                error={updateExercise.error?.message}
              />
            </div>
          ) : (
            <div
              key={exercise.id}
              className="bg-surface-secondary rounded-xl p-4 flex items-start justify-between"
            >
              <div className="space-y-1">
                <p className="font-bold text-content-inverse">{exercise.name}</p>
                <p className="text-sm text-content-inverse/60">
                  {getPrimaryMuscleGroup(exercise)?.name}
                  {exercise.muscleGroups.length > 1 &&
                    ` 他${exercise.muscleGroups.length - 1}部位`}
                </p>
                {exercise.description && (
                  <p className="text-xs text-content-inverse/50">{exercise.description}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0 ml-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingExercise(exercise)}
                  className="text-content-inverse/60 hover:text-content-inverse"
                >
                  編集
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDelete(exercise.id)}
                  disabled={deleteExercise.isPending}
                >
                  削除
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
    </PageLayout>
  )
}
