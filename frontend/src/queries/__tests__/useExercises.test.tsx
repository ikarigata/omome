import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { waitFor } from '@testing-library/react'
import { useExercises, useCreateExercise } from '../useExercises'
import { renderHookWithClient } from '@/test/utils'
import { server } from '@/mocks/server'
import { generateId } from '@/lib/uuid'

describe('useExercises', () => {
  it('一覧をフェッチして成功する', async () => {
    const { result } = renderHookWithClient(() => useExercises())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.length).toBeGreaterThan(0)
    expect(result.current.data?.[0]).toHaveProperty('name')
  })

  it('サーバエラー時に isError になる（retry オフ）', async () => {
    server.use(
      http.get('/api/v1/exercises', () => new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHookWithClient(() => useExercises())
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateExercise', () => {
  it('作成成功後に exercises 一覧が invalidate される', async () => {
    const { result, queryClient } = renderHookWithClient(() => ({
      list: useExercises(),
      create: useCreateExercise(),
    }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const before = result.current.list.data!.length

    await result.current.create.mutateAsync({
      id: generateId(),
      name: 'インクラインプレス',
      muscleGroups: [{ id: 'a1b2c3d4-0001-4001-8001-000000000001', isPrimary: true }],
    })

    // invalidate により再フェッチされ件数が増える
    await waitFor(() => {
      expect(queryClient.getQueryState(['exercises'])?.isInvalidated).toBe(false)
      expect(result.current.list.data!.length).toBe(before + 1)
    })
  })
})
