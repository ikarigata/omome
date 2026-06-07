import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/resources/users'
import type { UserUpdateRequest } from '@/api/types'
import { queryKeys } from './queryKeys'

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => usersApi.getMe(),
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UserUpdateRequest) => usersApi.updateMe(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })
}
