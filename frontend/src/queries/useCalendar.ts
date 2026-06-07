import { useQuery } from '@tanstack/react-query'
import { workoutDaysApi } from '@/api/resources/workoutDays'
import { queryKeys } from './queryKeys'

export function useCalendar(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.calendar(year, month),
    queryFn: () => workoutDaysApi.calendar(year, month),
  })
}
