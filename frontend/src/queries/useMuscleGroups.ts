import { useQuery } from '@tanstack/react-query'
import { muscleGroupsApi } from '@/api/resources/muscleGroups'
import { queryKeys } from './queryKeys'

export function useMuscleGroups() {
  return useQuery({
    queryKey: queryKeys.muscleGroups.all(),
    queryFn: () => muscleGroupsApi.list(),
    staleTime: Infinity,
  })
}
