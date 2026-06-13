export const queryKeys = {
  exercises: {
    all: () => ['exercises'] as const,
    detail: (id: string) => ['exercises', id] as const,
    progress: (id: string) => ['exercises', id, 'progress'] as const,
  },
  muscleGroups: {
    all: () => ['muscleGroups'] as const,
    detail: (id: string) => ['muscleGroups', id] as const,
  },
  workoutDays: {
    all: () => ['workoutDays'] as const,
    detail: (id: string) => ['workoutDays', id] as const,
    records: (id: string) => ['workoutDays', id, 'records'] as const,
  },
  workoutRecords: {
    detail: (id: string) => ['workoutRecords', id] as const,
    sets: (recordId: string) => ['workoutRecords', recordId, 'sets'] as const,
  },
  me: () => ['me'] as const,
  calendar: (year: number, month: number) => ['calendar', year, month] as const,
}
