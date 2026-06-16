import { describe, it, expect } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient } from '@tanstack/react-query'
import { useUpsertWorkoutRecord } from '../useWorkoutRecords'
import { queryKeys } from '../queryKeys'
import { renderHookWithClient } from '@/test/utils'
import { server } from '@/mocks/server'
import { generateId } from '@/lib/uuid'
import type { WorkoutRecordResponse, WorkoutSetResponse } from '@/api/types'

const BASE = '/api/v1'

const dayId = 'd0000000-0000-4000-8000-000000000099'

// 既定のテスト用 client は gcTime:0 で、オブザーバの無いキャッシュが即時GCされる。
// ここはキャッシュ内容そのものを検証するため、保持する client を使う
// （実アプリでは一覧クエリのオブザーバがいるので保持される）。
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

describe('useUpsertWorkoutRecord（楽観的更新）', () => {
  it('作成往復を待たず records と sets を即時反映し、成功で実レコードに合流する', async () => {
    const qc = makeClient()
    // 一覧キャッシュを空で用意しておく（楽観挿入の対象）。
    qc.setQueryData<WorkoutRecordResponse[]>(queryKeys.workoutDays.records(dayId), [])

    const { result } = renderHookWithClient(() => useUpsertWorkoutRecord(), qc)

    const id = generateId()
    const exerciseId = generateId()
    act(() => {
      result.current.mutate({ id, workoutDayId: dayId, exerciseId })
    })

    // サーバ応答前に楽観挿入される（カードが即座に出る土台）。
    await waitFor(() => {
      const recs = qc.getQueryData<WorkoutRecordResponse[]>(queryKeys.workoutDays.records(dayId))
      expect(recs).toHaveLength(1)
      expect(recs?.[0]?.id).toBe(id)
    })
    // 新レコードの sets は空でシード済み（autoStart が取得を待たず行を作れる）。
    expect(qc.getQueryData<WorkoutSetResponse[]>(queryKeys.workoutRecords.sets(id))).toEqual([])

    // 成功後も id は維持され、一覧は重複しない。
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const recs = qc.getQueryData<WorkoutRecordResponse[]>(queryKeys.workoutDays.records(dayId))
    expect(recs).toHaveLength(1)
    expect(recs?.[0]?.id).toBe(id)
  })

  it('成功後は種目の集約（progress / history）を無効化する（履歴・統計の不整合防止）', async () => {
    const qc = makeClient()
    qc.setQueryData<WorkoutRecordResponse[]>(queryKeys.workoutDays.records(dayId), [])

    const exerciseId = generateId()
    // 既存の集約キャッシュを「鮮度あり」で用意し、書き込みで stale 化することを確認する。
    qc.setQueryData(queryKeys.exercises.progress(exerciseId), { exerciseId, points: [] })
    qc.setQueryData(queryKeys.exercises.history(exerciseId), { exerciseId, sessions: [] })

    const { result } = renderHookWithClient(() => useUpsertWorkoutRecord(), qc)

    act(() => {
      result.current.mutate({ id: generateId(), workoutDayId: dayId, exerciseId })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() => {
      expect(qc.getQueryState(queryKeys.exercises.progress(exerciseId))?.isInvalidated).toBe(true)
      expect(qc.getQueryState(queryKeys.exercises.history(exerciseId))?.isInvalidated).toBe(true)
    })
  })

  it('失敗したら楽観挿入を巻き戻し、シードした sets も消す', async () => {
    // この作成だけ 500 を返させる。
    server.use(
      http.post(`${BASE}/workout-records`, () => new HttpResponse(null, { status: 500 })),
    )

    const qc = makeClient()
    qc.setQueryData<WorkoutRecordResponse[]>(queryKeys.workoutDays.records(dayId), [])

    const { result } = renderHookWithClient(() => useUpsertWorkoutRecord(), qc)

    const id = generateId()
    const exerciseId = generateId()
    act(() => {
      result.current.mutate({ id, workoutDayId: dayId, exerciseId })
    })

    // 失敗が確定したら元の空一覧に戻り、シードした sets キャッシュも除かれる。
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(qc.getQueryData<WorkoutRecordResponse[]>(queryKeys.workoutDays.records(dayId))).toEqual([])
    expect(qc.getQueryData<WorkoutSetResponse[]>(queryKeys.workoutRecords.sets(id))).toBeUndefined()
  })
})
