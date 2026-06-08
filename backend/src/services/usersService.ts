import type { UsersRepository } from '../repositories/usersRepository.js'
import { NotFoundError } from '../middleware/error.js'
import type { UserResponse } from '@omome/shared'

type UserRow = NonNullable<Awaited<ReturnType<UsersRepository['findById']>>>

function toResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function createUsersService(deps: { usersRepo: UsersRepository }) {
  const { usersRepo } = deps

  return {
    async getMe(userId: string): Promise<UserResponse> {
      const user = await usersRepo.findById(userId)
      if (!user) throw new NotFoundError('User not found')
      return toResponse(user)
    },

    async updateMe(userId: string, data: { name: string }): Promise<UserResponse> {
      const user = await usersRepo.update(userId, { name: data.name })
      if (!user) throw new NotFoundError('User not found')
      return toResponse(user)
    },
  }
}

export type UsersService = ReturnType<typeof createUsersService>
