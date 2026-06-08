import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createUsersService } from '../usersService.js'
import { createMockUsersRepository } from '../../test/mockRepositories.js'

const USER = 'user-1'

function fakeUser() {
  return {
    id: USER,
    cognitoSub: 'sub-1',
    name: 'あすか',
    email: 'a@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function setup() {
  const usersRepo = createMockUsersRepository()
  const service = createUsersService({ usersRepo })
  return { usersRepo, service }
}

describe('usersService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getMe: 存在しないなら 404', async () => {
    const { usersRepo, service } = setup()
    vi.mocked(usersRepo.findById).mockResolvedValue(null as never)
    await expect(service.getMe(USER)).rejects.toMatchObject({ status: 404 })
  })

  it('getMe: プロフィールを返す（表示名は users.name）', async () => {
    const { usersRepo, service } = setup()
    vi.mocked(usersRepo.findById).mockResolvedValue(fakeUser() as never)
    const res = await service.getMe(USER)
    expect(res).toMatchObject({ id: USER, name: 'あすか', email: 'a@example.com' })
  })

  it('updateMe: 更新行を返す', async () => {
    const { usersRepo, service } = setup()
    vi.mocked(usersRepo.update).mockResolvedValue({ ...fakeUser(), name: '更新後' } as never)
    const res = await service.updateMe(USER, { name: '更新後' })
    expect(usersRepo.update).toHaveBeenCalledWith(USER, { name: '更新後' })
    expect(res.name).toBe('更新後')
  })
})
