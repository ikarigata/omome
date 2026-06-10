import { useNavigate, useParams } from 'react-router-dom'
import { useExercises } from '@/queries/useExercises'
import { useWorkoutRecordsByDay, useUpsertWorkoutRecord } from '@/queries/useWorkoutRecords'
import { PageLayout } from '@/components/PageLayout'
import { generateId } from '@/lib/uuid'
import { getPrimaryMuscleGroup } from '@/lib/exercise'

export function ExerciseSelectPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()

  const { data: exercises = [] } = useExercises()
  const { data: records = [] } = useWorkoutRecordsByDay(workoutId ?? '')
  const upsertRecord = useUpsertWorkoutRecord()

  const recordedExerciseIds = new Set(records.map((r) => r.exerciseId))
  const available = exercises.filter((e) => !recordedExerciseIds.has(e.id))

  async function handleSelect(exerciseId: string) {
    if (!workoutId) return
    const id = generateId()
    await upsertRecord.mutateAsync({
      id,
      workoutDayId: workoutId,
      exerciseId,
    })
    // 追加した記録の id を渡し、戻り先で最初のセットを自動作成＆フォーカスさせる。
    navigate(`/workout/${workoutId}`, { state: { focusRecordId: id } })
  }

  return (
    <PageLayout title="種目を選択">
      <div className="p-4 space-y-2">
        {available.length === 0 && (
          <p className="text-center text-content-secondary text-sm py-8">
            追加できる種目がありません
          </p>
        )}
        {available.map((exercise) => (
          <button
            key={exercise.id}
            onClick={() => void handleSelect(exercise.id)}
            disabled={upsertRecord.isPending}
            className="w-full text-left bg-surface-secondary text-content-inverse rounded-xl p-4 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            <p className="font-bold">{exercise.name}</p>
            <p className="text-sm text-content-inverse/60">
              {getPrimaryMuscleGroup(exercise)?.name}
              {exercise.muscleGroups.length > 1 && ` 他${exercise.muscleGroups.length - 1}部位`}
            </p>
          </button>
        ))}
      </div>
    </PageLayout>
  )
}
