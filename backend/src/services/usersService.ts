import { usersRepository } from '../repositories/usersRepository.js'
import { NotFoundError } from '../middleware/error.js'
import type { UserResponse } from '@omome/shared'

function toResponse(user: NonNullable<Awaited<ReturnType<typeof usersRepository.findById>>>): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export const usersService = {
  async getMe(userId: string): Promise<UserResponse> {
    const user = await usersRepository.findById(userId)
    if (!user) throw new NotFoundError('User not found')
    return toResponse(user)
  },

  async updateMe(userId: string, data: { name: string }): Promise<UserResponse> {
    const user = await usersRepository.update(userId, { name: data.name })
    if (!user) throw new NotFoundError('User not found')
    return toResponse(user)
  },
}
