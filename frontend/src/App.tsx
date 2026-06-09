import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PrivateRoute, PublicRoute } from '@/app/router'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { HomePage } from '@/pages/HomePage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ExercisesPage } from '@/pages/ExercisesPage'
import { WorkoutDayPage } from '@/pages/WorkoutDayPage'
import { ExerciseSelectPage } from '@/pages/ExerciseSelectPage'

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
          <Route path="/workout/:workoutId" element={<WorkoutDayPage />} />
          <Route path="/workout/:workoutId/exercises" element={<ExerciseSelectPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
