import { describe, it, expect } from 'vitest'
import { UserUpdateRequestSchema, UserResponseSchema } from '../user.js'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('UserUpdateRequestSchema', () => {
  it('name のみ必須 → OK', () => {
    expect(UserUpdateRequestSchema.safeParse({ name: 'あすか' }).success).toBe(true)
  })

  it('空名 → エラー', () => {
    expect(UserUpdateRequestSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('name 欠落 → エラー', () => {
    expect(UserUpdateRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('UserResponseSchema', () => {
  it('email null 許容', () => {
    const r = UserResponseSchema.safeParse({
      id: UUID,
      name: 'あすか',
      email: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })

  it('不正な email → エラー', () => {
    const r = UserResponseSchema.safeParse({
      id: UUID,
      name: 'あすか',
      email: 'not-an-email',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(r.success).toBe(false)
  })
})
