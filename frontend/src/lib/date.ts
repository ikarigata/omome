export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayString(): string {
  return toDateString(new Date())
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}/${m}/${d}`
}

export function formatDateJa(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function getDayOfWeekJa(dateStr: string): string {
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const date = new Date(dateStr)
  return days[date.getDay()] ?? ''
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}
