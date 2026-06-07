import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useWorkoutDay, useUpdateWorkoutDay, useDeleteWorkoutDay } from '@/queries/useWorkoutDays'
import { useWorkoutRecordsByDay, useDeleteWorkoutRecord } from '@/queries/useWorkoutRecords'
import { useExercises } from '@/queries/useExercises'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { formatDateJa, getDayOfWeekJa } from '@/lib/date'

export function WorkoutDayPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()

  const { data: day, isLoading: dayLoading } = useWorkoutDay(workoutId ?? '')
  const { data: records = [] } = useWorkoutRecordsByDay(workoutId ?? '')
  const { data: exercises = [] } = useExercises()

  const updateDay = useUpdateWorkoutDay()
  const deleteDay = useDeleteWorkoutDay()
  const deleteRecord = useDeleteWorkoutRecord()

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  function startEdit() {
    setTitle(day?.title ?? '')
    setNotes(day?.notes ?? '')
    setEditing(true)
  }

  async function handleSave() {
    if (!workoutId) return
    await updateDay.mutateAsync({ id: workoutId, data: { title: title || null, notes: notes || null } })
    setEditing(false)
  }

  async function handleDelete() {
    if (!workoutId) return
    if (!confirm('このトレーニング日を削除しますか？')) return
    await deleteDay.mutateAsync(workoutId)
    navigate('/')
  }

  async function handleDeleteRecord(recordId: string) {
    if (!workoutId) return
    if (!confirm('この記録を削除しますか？')) return
    await deleteRecord.mutateAsync({ id: recordId, workoutDayId: workoutId })
  }

  if (dayLoading) {
    return (
      <PageLayout>
        <p className="text-center text-content-secondary text-sm py-8">読み込み中…</p>
      </PageLayout>
    )
  }

  if (!day) {
    return (
      <PageLayout>
        <p className="text-center text-content-secondary text-sm py-8">見つかりません</p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={`${formatDateJa(day.date)}（${getDayOfWeekJa(day.date)}）`}
      headerRight={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={startEdit}>
            編集
          </Button>
          <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={deleteDay.isPending}>
            削除
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {editing ? (
          <div className="bg-surface-secondary rounded-xl p-4 space-y-3">
            <Input
              label="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="胸の日"
              className="text-content-inverse bg-surface-container"
            />
            <Input
              label="メモ"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="調子よかった"
              className="text-content-inverse bg-surface-container"
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setEditing(false)} className="flex-1">
                キャンセル
              </Button>
              <Button onClick={() => void handleSave()} disabled={updateDay.isPending} className="flex-1">
                保存
              </Button>
            </div>
          </div>
        ) : (
          <>
            {day.title && <h2 className="font-bold text-xl">{day.title}</h2>}
            {day.notes && <p className="text-sm text-content-secondary">{day.notes}</p>}
          </>
        )}

        <Link
          to={`/workout/${workoutId}/exercises`}
          className="block w-full text-center bg-interactive-primary text-content-inverse rounded-xl py-3 font-bold hover:bg-interactive-hover transition-colors"
        >
          ＋ 種目を追加
        </Link>

        {records.length === 0 && (
          <p className="text-center text-content-secondary text-sm py-4">
            まだ記録がありません
          </p>
        )}

        {records.map((record) => {
          const exercise = exercises.find((e) => e.id === record.exerciseId)
          return (
            <div key={record.id} className="bg-surface-secondary rounded-xl p-4">
              <div className="flex items-center justify-between">
                <Link
                  to={`/workout/${workoutId}/exercise/${record.exerciseId}`}
                  className="font-bold text-content-inverse hover:opacity-80"
                >
                  {exercise?.name ?? '種目不明'}
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDeleteRecord(record.id)}
                  disabled={deleteRecord.isPending}
                >
                  削除
                </Button>
              </div>
              {record.notes && (
                <p className="text-sm text-content-inverse/60 mt-1">{record.notes}</p>
              )}
            </div>
          )
        })}
      </div>
    </PageLayout>
  )
}
