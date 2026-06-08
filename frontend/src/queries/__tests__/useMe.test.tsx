import { describe, it, expect } from 'vitest'
import { waitFor } from '@testing-library/react'
import { useMe, useUpdateMe } from '../useMe'
import { renderHookWithClient } from '@/test/utils'

describe('useMe', () => {
  it('プロフィールを GET /users/me から取得する', async () => {
    const { result } = renderHookWithClient(() => useMe())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveProperty('name')
  })

  it('updateMe で name を更新し me が invalidate される', async () => {
    const { result } = renderHookWithClient(() => ({
      me: useMe(),
      update: useUpdateMe(),
    }))
    await waitFor(() => expect(result.current.me.isSuccess).toBe(true))

    await result.current.update.mutateAsync({ name: '新しい名前' })
    await waitFor(() => expect(result.current.me.data?.name).toBe('新しい名前'))
  })
})
