import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { useWorkoutDay, useUpdateWorkoutDay, useDeleteWorkoutDay } from '@/queries/useWorkoutDays'
import { useWorkoutRecordsByDay, useDeleteWorkoutRecord } from '@/queries/useWorkoutRecords'
import { useExercises } from '@/queries/useExercises'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { ExerciseSetEditor } from '@/components/ExerciseSetEditor'
import { formatDateJa, getDayOfWeekJa } from '@/lib/date'

export function WorkoutDayPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // 種目追加から戻ってきたときの対象記録 id（最初のセットを自動作成＆フォーカス）。
  const focusRecordId = (location.state as { focusRecordId?: string } | null)?.focusRecordId

  const { data: day, isLoading: dayLoading } = useWorkoutDay(workoutId ?? '')
  const { data: records = [] } = useWorkoutRecordsByDay(workoutId ?? '')
  const { data: exercises = [] } = useExercises()

  const updateDay = useUpdateWorkoutDay()
  const deleteDay = useDeleteWorkoutDay()
  const deleteRecord = useDeleteWorkoutRecord()

  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  // 折り畳まれた記録の id 集合。未収録＝展開（既定は全て展開）。
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleCollapsed(recordId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      return next
    })
  }

  function startEdit() {
    setNotes(day?.notes ?? '')
    setEditing(true)
  }

  async function handleSave() {
    if (!workoutId) return
    await updateDay.mutateAsync({ id: workoutId, data: { notes: notes || null } })
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
            {day.notes && <p className="text-sm text-content-secondary">{day.notes}</p>}
          </>
        )}

        {records.length === 0 && (
          <p className="text-center text-content-secondary text-sm py-4">
            まだ記録がありません
          </p>
        )}

        {records.map((record) => {
          const exercise = exercises.find((e) => e.id === record.exerciseId)
          const isCollapsed = collapsed.has(record.id)
          return (
            <div key={record.id} className="bg-surface-secondary rounded-xl p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(record.id)}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-2 font-bold text-content-inverse hover:opacity-80 text-left"
                >
                  <span
                    aria-hidden
                    className={`text-content-inverse/60 text-xs transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${isCollapsed ? '' : 'rotate-90'}`}
                  >
                    ▶
                  </span>
                  {exercise?.name ?? '種目不明'}
                </button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDeleteRecord(record.id)}
                  disabled={deleteRecord.isPending}
                >
                  削除
                </Button>
              </div>
              {/* grid-template-rows を 0fr↔1fr で遷移させ、高さを滑らかに開閉する。
                  中身は常にマウントしたまま overflow-hidden でクリップする。 */}
              <div
                className={`grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                }`}
              >
                <div className="overflow-hidden min-h-0">
                  <div className="space-y-3 pt-3">
                    {record.notes && (
                      <p className="text-sm text-content-inverse/60">{record.notes}</p>
                    )}
                    <ExerciseSetEditor
                      workoutRecordId={record.id}
                      autoStart={record.id === focusRecordId}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        <Link
          to={`/workout/${workoutId}/exercises`}
          className="block w-full text-center bg-interactive-primary text-content-inverse rounded-xl py-3 font-bold hover:bg-interactive-hover transition-colors"
        >
          ＋ 種目を追加
        </Link>
      </div>
    </PageLayout>
  )
}
