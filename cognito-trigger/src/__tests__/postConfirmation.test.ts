import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PostConfirmationTriggerEvent } from 'aws-lambda'

// @libsql/client/web の createClient をモック。handler はモジュール読込時に createClient()
// を1回呼び、返ってきた client.execute({ sql, args }) で INSERT を発行する。
// 同じ参照を返すことで呼び出しを記録できる。
const h = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@libsql/client/web', () => ({
  createClient: () => ({ execute: h.execute }),
}))

import { handler } from '../postConfirmation'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function makeEvent(
  userAttributes: Record<string, string | undefined>,
): PostConfirmationTriggerEvent {
  return {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    request: { userAttributes: userAttributes as Record<string, string> },
    response: {},
  } as PostConfirmationTriggerEvent
}

// 直近の execute 呼び出しの { sql, args } を取り出すヘルパ
function lastInsert() {
  const [arg] = h.execute.mock.calls.at(-1)! as [{ sql: string; args: unknown[] }]
  return { sql: arg.sql, values: arg.args }
}

describe('postConfirmation handler', () => {
  beforeEach(() => {
    h.execute.mockReset()
    h.execute.mockResolvedValue({ rows: [] })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('sub/name/email から users 行を INSERT し、id はアプリ生成 UUIDv4', async () => {
    const event = makeEvent({ sub: 'cognito-sub-1', name: '飛鳥', email: 'asuka@example.com' })
    const result = await handler(event)

    expect(h.execute).toHaveBeenCalledTimes(1)
    const { sql, values } = lastInsert()
    expect(sql).toContain('INSERT INTO users')
    // args = [id, sub, name, email]
    expect(values[0]).toMatch(UUID_V4)
    expect(values[1]).toBe('cognito-sub-1')
    expect(values[2]).toBe('飛鳥')
    expect(values[3]).toBe('asuka@example.com')
    // ハンドラはイベントをそのまま返す
    expect(result).toBe(event)
  })

  it('email 未取得は NULL を挿入', async () => {
    await handler(makeEvent({ sub: 'sub-2', name: '太郎' }))
    const { values } = lastInsert()
    expect(values[3]).toBeNull()
  })

  it('ON CONFLICT (cognito_sub) DO NOTHING で冪等（再実行で重複作成しない）', async () => {
    const { sql } = (await handler(makeEvent({ sub: 'sub-3', name: '花子' })), lastInsert())
    expect(sql).toContain('ON CONFLICT')
    expect(sql).toContain('cognito_sub')
    expect(sql).toContain('DO NOTHING')

    // 同じ sub で再実行しても throw せず、毎回 INSERT を発行（重複排除は DB 側の責務）
    h.execute.mockClear()
    await expect(handler(makeEvent({ sub: 'sub-3', name: '花子' }))).resolves.toBeDefined()
    expect(h.execute).toHaveBeenCalledTimes(1)
  })

  it('sub 欠落で throw し、INSERT を発行しない', async () => {
    await expect(handler(makeEvent({ name: '飛鳥' }))).rejects.toThrow(/sub/)
    expect(h.execute).not.toHaveBeenCalled()
  })

  it('name 欠落で throw し、INSERT を発行しない', async () => {
    await expect(handler(makeEvent({ sub: 'sub-4' }))).rejects.toThrow()
    expect(h.execute).not.toHaveBeenCalled()
  })
})
