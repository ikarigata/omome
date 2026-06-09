import { NavLink, useNavigate } from 'react-router-dom'
import { todayString } from '@/lib/date'
import { generateId } from '@/lib/uuid'
import { useWorkoutDays } from '@/queries/useWorkoutDays'
import { useCreateWorkoutDay } from '@/queries/useWorkoutDays'

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-8">
      <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  )
}

function DumbbellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M6 6h12v2H6zM6 16h12v2H6zM4 8h2v8H4zM18 8h2v8h-2zM2 10h2v4H2zM20 10h2v4h-2z"/>
    </svg>
  )
}

export function BottomNav() {
  const navigate = useNavigate()
  const { data: workoutDays } = useWorkoutDays()
  const createDay = useCreateWorkoutDay()

  async function handlePlusClick() {
    const today = todayString()
    const existing = workoutDays?.find((d) => d.date === today)
    if (existing) {
      navigate(`/workout/${existing.id}`)
      return
    }
    const result = await createDay.mutateAsync({
      id: generateId(),
      date: today,
    })
    navigate(`/workout/${result.id}`)
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 text-xs transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-navigation-bg text-navigation-text safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        <NavLink to="/" end className={navLinkClass}>
          <HomeIcon />
          <span>ホーム</span>
        </NavLink>

        <NavLink to="/calendar" className={navLinkClass}>
          <CalendarIcon />
          <span>カレンダー</span>
        </NavLink>

        <button
          onClick={() => void handlePlusClick()}
          className="flex flex-col items-center gap-0.5 text-xs opacity-100"
          disabled={createDay.isPending}
        >
          <PlusIcon />
          <span>今日</span>
        </button>

        <NavLink to="/exercises" className={navLinkClass}>
          <DumbbellIcon />
          <span>種目</span>
        </NavLink>
      </div>
    </nav>
  )
}
