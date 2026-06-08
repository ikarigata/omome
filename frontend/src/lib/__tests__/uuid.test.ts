import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateId } from '../uuid'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('crypto.randomUUID があればそれを使う', () => {
    const id = generateId()
    expect(id).toMatch(UUID_V4)
  })

  it('一意な値を返す', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('randomUUID 非対応でも getRandomValues フォールバックで v4 を生成', () => {
    vi.stubGlobal('crypto', {
      randomUUID: undefined,
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i
        return arr
      },
    })
    const id = generateId()
    expect(id).toMatch(UUID_V4)
  })
})
