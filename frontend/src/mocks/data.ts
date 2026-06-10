import type {
  ExerciseResponse,
  MuscleGroupResponse,
  UserResponse,
  WorkoutDayResponse,
  WorkoutRecordResponse,
  WorkoutSetResponse,
} from '@/api/types'

// 見た目確認用のインメモリ・ストア。
// handlers がこのオブジェクトを直接書き換えるので、作成/更新/削除も画面に反映される
// （リロードで初期状態に戻る）。

const now = () => new Date().toISOString()

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

// ── 部位マスタ（backend のシードと同じ ID） ──
export const muscleGroups: MuscleGroupResponse[] = [
  { id: 'a1b2c3d4-0001-4001-8001-000000000001', name: '胸', createdAt: now() },
  { id: 'a1b2c3d4-0002-4002-8002-000000000002', name: '肩', createdAt: now() },
  { id: 'a1b2c3d4-0003-4003-8003-000000000003', name: '背中', createdAt: now() },
  { id: 'a1b2c3d4-0004-4004-8004-000000000004', name: '腕', createdAt: now() },
  { id: 'a1b2c3d4-0005-4005-8005-000000000005', name: '腹', createdAt: now() },
  { id: 'a1b2c3d4-0006-4006-8006-000000000006', name: '脚', createdAt: now() },
  { id: 'a1b2c3d4-0007-4007-8007-000000000007', name: 'その他', createdAt: now() },
]

const mg = (i: number) => muscleGroups[i]!

export const me: UserResponse = {
  id: 'u0000000-0000-4000-8000-000000000000',
  name: '飛鳥',
  email: 'asuka@example.com',
  createdAt: now(),
  updatedAt: now(),
}

export const exercises: ExerciseResponse[] = [
  {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'ベンチプレス',
    description: 'フラットベンチで行う基本種目',
    muscleGroups: [
      { id: mg(0).id, name: mg(0).name, isPrimary: true },
      { id: mg(3).id, name: mg(3).name, isPrimary: false },
    ],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'e0000000-0000-4000-8000-000000000002',
    name: 'スクワット',
    description: 'バーベルを担いで行う',
    muscleGroups: [{ id: mg(5).id, name: mg(5).name, isPrimary: true }],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'e0000000-0000-4000-8000-000000000003',
    name: 'デッドリフト',
    description: null,
    muscleGroups: [
      { id: mg(2).id, name: mg(2).name, isPrimary: true },
      { id: mg(5).id, name: mg(5).name, isPrimary: false },
    ],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'e0000000-0000-4000-8000-000000000004',
    name: 'ショルダープレス',
    description: 'ダンベルで肩を狙う',
    muscleGroups: [{ id: mg(1).id, name: mg(1).name, isPrimary: true }],
    createdAt: now(),
    updatedAt: now(),
  },
]

export const workoutDays: WorkoutDayResponse[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    date: daysAgo(0),
    title: '胸の日',
    notes: '調子よかった',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    date: daysAgo(2),
    title: '脚の日',
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    date: daysAgo(5),
    title: null,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
]

export const workoutRecords: WorkoutRecordResponse[] = [
  {
    id: 'r0000000-0000-4000-8000-000000000001',
    workoutDayId: workoutDays[0]!.id,
    exerciseId: exercises[0]!.id,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'r0000000-0000-4000-8000-000000000002',
    workoutDayId: workoutDays[1]!.id,
    exerciseId: exercises[1]!.id,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'r0000000-0000-4000-8000-000000000003',
    workoutDayId: workoutDays[2]!.id,
    exerciseId: exercises[2]!.id,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
]

export const workoutSets: WorkoutSetResponse[] = [
  {
    id: 's0000000-0000-4000-8000-000000000001',
    workoutRecordId: workoutRecords[0]!.id,
    reps: 10,
    weight: 60,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's0000000-0000-4000-8000-000000000002',
    workoutRecordId: workoutRecords[0]!.id,
    reps: 8,
    weight: 70,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's0000000-0000-4000-8000-000000000003',
    workoutRecordId: workoutRecords[1]!.id,
    reps: 12,
    weight: 80,
    createdAt: now(),
    updatedAt: now(),
  },
]

export const ts = now
