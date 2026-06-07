import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCalendar } from '@/queries/useCalendar'
import { PageLayout } from '@/components/PageLayout'
import { getDaysInMonth, getFirstDayOfWeek } from '@/lib/date'
import type { CalendarResponse } from '@/api/types'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

interface DayEntry {
  workoutDayId: string
  date: string
  title?: string | null
  exerciseNames: string[]
}

function buildDayMap(data: CalendarResponse | undefined): Map<string, DayEntry> {
  const map = new Map<string, DayEntry>()
  data?.days.forEach((d) => map.set(d.date, d))
  return map
}

export function CalendarPage() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const { data } = useCalendar(year, month)
  const dayMap = buildDayMap(data)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const paddingEnd = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7)
  const allCells: (number | null)[] = [...cells, ...Array<null>(paddingEnd).fill(null)]

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  return (
    <PageLayout title="カレンダー">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="px-3 py-1 rounded-lg bg-surface-container text-content-inverse text-sm"
          >
            ‹ 前月
          </button>
          <span className="font-bold">
            {year}年{month}月
          </span>
          <button
            onClick={nextMonth}
            className="px-3 py-1 rounded-lg bg-surface-container text-content-inverse text-sm"
          >
            翌月 ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs text-content-secondary py-1">
              {d}
            </div>
          ))}

          {allCells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="aspect-square" />
            }

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const entry = dayMap.get(dateStr)
            const isToday =
              dateStr ===
              `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

            return (
              <button
                key={dateStr}
                onClick={() => entry && navigate(`/workout/${entry.workoutDayId}`)}
                className={`aspect-square rounded-lg p-1 text-left flex flex-col overflow-hidden transition-opacity ${
                  entry
                    ? 'bg-surface-secondary text-content-inverse hover:opacity-80 cursor-pointer'
                    : 'bg-transparent cursor-default'
                } ${isToday && !entry ? 'ring-1 ring-content-accent' : ''}`}
              >
                <span
                  className={`text-xs font-bold ${entry ? 'text-content-inverse' : 'text-content-primary'} ${isToday ? 'text-content-accent' : ''}`}
                >
                  {day}
                </span>
                {entry && (
                  <div className="flex-1 overflow-hidden">
                    {entry.exerciseNames.slice(0, 4).map((name, idx) => (
                      <p key={idx} className="text-[9px] leading-tight text-content-inverse/70 truncate">
                        {name}
                      </p>
                    ))}
                    {entry.exerciseNames.length > 4 && (
                      <p className="text-[9px] text-content-inverse/50">
                        +{entry.exerciseNames.length - 4}
                      </p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </PageLayout>
  )
}
