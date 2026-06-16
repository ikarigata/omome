import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PrivateRoute, PublicRoute } from '@/app/router'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { HomePage } from '@/pages/HomePage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ExercisesPage } from '@/pages/ExercisesPage'
import { WorkoutDayPage } from '@/pages/WorkoutDayPage'

// 統計・履歴画面は recharts（重い）に依存するため遅延読み込みし、メインバンドルから
// 切り離す。recharts は両者で共有チャンク化される。
const StatisticsPage = lazy(() =>
  import('@/pages/StatisticsPage').then((m) => ({ default: m.StatisticsPage })),
)
const ExerciseHistoryPage = lazy(() =>
  import('@/pages/ExerciseHistoryPage').then((m) => ({ default: m.ExerciseHistoryPage })),
)

const pageFallback = (
  <div className="flex min-h-dvh items-center justify-center">
    <span className="text-content-secondary text-sm">読み込み中…</span>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route
            path="/statistics"
            element={<Suspense fallback={pageFallback}>{<StatisticsPage />}</Suspense>}
          />
          <Route path="/workout/:workoutId" element={<WorkoutDayPage />} />
          <Route
            path="/exercises/:exerciseId/history"
            element={<Suspense fallback={pageFallback}>{<ExerciseHistoryPage />}</Suspense>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
