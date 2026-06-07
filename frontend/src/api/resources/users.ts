import { apiClient } from '../client'
import type { UserResponse, UserUpdateRequest } from '../types'

export const usersApi = {
  getMe: () => apiClient.get<UserResponse>('/users/me'),

  updateMe: (data: UserUpdateRequest) => apiClient.put<UserResponse>('/users/me', data),
}
