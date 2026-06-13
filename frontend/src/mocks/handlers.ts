import { http, HttpResponse } from 'msw'
import type {
  ExerciseResponse,
  ExerciseUpsertRequest,
  WorkoutDayCreateRequest,
  WorkoutDayUpdateRequest,
  WorkoutRecordUpsertRequest,
  WorkoutSetCreateRequest,
  WorkoutSetUpdateRequest,
  WorkoutSetReorderRequest,
  CalendarResponse,
} from '@/api/types'
import * as db from './data'

const BASE = '/api/v1'

// muscleGroups の id → 名前解決（種目の muscleGroups レスポンス組み立て用）
function resolveMuscleGroups(
  input: { id: string; isPrimary: boolean }[],
): ExerciseResponse['muscleGroups'] {
  const resolved = input.map((g) => ({
    id: g.id,
    name: db.muscleGroups.find((m) => m.id === g.id)?.name ?? '不明',
    isPrimary: g.isPrimary,
  }))
  // メインを先頭に
  return resolved.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
}

export const handlers = [
  // ── users ──
  http.get(`${BASE}/users/me`, () => HttpResponse.json(db.me)),
  http.put(`${BASE}/users/me`, async ({ request }) => {
    const body = (await request.json()) as { name: string }
    db.me.name = body.name
    db.me.updatedAt = db.ts()
    return HttpResponse.json(db.me)
  }),

  // ── muscle-groups ──
  http.get(`${BASE}/muscle-groups`, () => HttpResponse.json(db.muscleGroups)),

  // ── exercises ──
  http.get(`${BASE}/exercises`, () => HttpResponse.json(db.exercises)),
  // 統計：種目の進捗をセッション（トレーニング日）単位で集約（バックエンドと同等のロジック）
  http.get(`${BASE}/exercises/:id/progress`, ({ params }) => {
    const exerciseId = params.id as string
    const dateByDay = new Map(db.workoutDays.map((d) => [d.id, d.date]))
    const recordsForExercise = db.workoutRecords.filter((r) => r.exerciseId === exerciseId)

    const byDay = new Map<
      string,
      { workoutDayId: string; date: string; totalVolume: number; maxWeight: number; oneRM: number }
    >()
    for (const rec of recordsForExercise) {
      const date = dateByDay.get(rec.workoutDayId)
      if (!date) continue
      const sets = db.workoutSets.filter((s) => s.workoutRecordId === rec.id)
      const point = byDay.get(rec.workoutDayId) ?? {
        workoutDayId: rec.workoutDayId,
        date,
        totalVolume: 0,
        maxWeight: 0,
        oneRM: 0,
      }
      for (const s of sets) {
        point.totalVolume += s.reps * s.weight
        point.maxWeight = Math.max(point.maxWeight, s.weight)
        const est = s.reps > 0 && s.weight > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0
        point.oneRM = Math.max(point.oneRM, est)
      }
      byDay.set(rec.workoutDayId, point)
    }

    const points = Array.from(byDay.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        workoutDayId: p.workoutDayId,
        date: p.date,
        totalVolume: p.totalVolume,
        maxWeight: p.maxWeight,
        estimatedOneRepMax: p.oneRM,
      }))

    return HttpResponse.json({ exerciseId, points })
  }),
  http.post(`${BASE}/exercises`, async ({ request }) => {
    const body = (await request.json()) as ExerciseUpsertRequest
    const existing = db.exercises.find((e) => e.id === body.id)
    if (existing) return HttpResponse.json(existing) // 冪等（PK重複→既存返却）
    const created: ExerciseResponse = {
      id: body.id,
      name: body.name,
      description: body.description ?? null,
      muscleGroups: resolveMuscleGroups(body.muscleGroups),
      createdAt: db.ts(),
      updatedAt: db.ts(),
    }
    db.exercises.push(created)
    return HttpResponse.json(created)
  }),
  http.get(`${BASE}/exercises/:id`, ({ params }) => {
    const e = db.exercises.find((x) => x.id === params.id)
    return e ? HttpResponse.json(e) : new HttpResponse(null, { status: 404 })
  }),
  http.put(`${BASE}/exercises/:id`, async ({ params, request }) => {
    const body = (await request.json()) as ExerciseUpsertRequest
    const idx = db.exercises.findIndex((x) => x.id === params.id)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    db.exercises[idx] = {
      ...db.exercises[idx]!,
      name: body.name,
      description: body.description ?? null,
      muscleGroups: resolveMuscleGroups(body.muscleGroups),
      updatedAt: db.ts(),
    }
    return HttpResponse.json(db.exercises[idx])
  }),
  http.delete(`${BASE}/exercises/:id`, ({ params }) => {
    const idx = db.exercises.findIndex((x) => x.id === params.id)
    if (idx !== -1) db.exercises.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── workout-days/calendar （:id より前に置く） ──
  http.get(`${BASE}/workout-days/calendar`, ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year'))
    const month = Number(url.searchParams.get('month'))
    const prefix = `${year}-${String(month).padStart(2, '0')}`

    const days: CalendarResponse['days'] = db.workoutDays
      .filter((d) => d.date.startsWith(prefix))
      .map((d) => {
        const recs = db.workoutRecords.filter((r) => r.workoutDayId === d.id)
        const exerciseNames = recs
          .map((r) => db.exercises.find((e) => e.id === r.exerciseId)?.name)
          .filter((n): n is string => !!n)
        return { workoutDayId: d.id, date: d.date, title: d.title, exerciseNames }
      })

    return HttpResponse.json({ year, month, days } satisfies CalendarResponse)
  }),

  // ── workout-days ──
  // 一覧では各日の実施種目のメイン部位名を集約して付与する（バックエンドと同形）。
  http.get(`${BASE}/workout-days`, () => {
    const withMuscleGroups = db.workoutDays.map((d) => {
      const names: string[] = []
      for (const r of db.workoutRecords.filter((r) => r.workoutDayId === d.id)) {
        const ex = db.exercises.find((e) => e.id === r.exerciseId)
        const primary = ex?.muscleGroups.find((g) => g.isPrimary)?.name
        if (primary && !names.includes(primary)) names.push(primary)
      }
      return { ...d, muscleGroups: names }
    })
    return HttpResponse.json(withMuscleGroups)
  }),
  http.post(`${BASE}/workout-days`, async ({ request }) => {
    const body = (await request.json()) as WorkoutDayCreateRequest
    const existing = db.workoutDays.find((d) => d.id === body.id)
    if (existing) return HttpResponse.json(existing)
    const created = {
      id: body.id,
      date: body.date,
      title: body.title ?? null,
      notes: body.notes ?? null,
      createdAt: db.ts(),
      updatedAt: db.ts(),
    }
    db.workoutDays.push(created)
    return HttpResponse.json(created)
  }),
  http.get(`${BASE}/workout-days/:id`, ({ params }) => {
    const d = db.workoutDays.find((x) => x.id === params.id)
    return d ? HttpResponse.json(d) : new HttpResponse(null, { status: 404 })
  }),
  http.put(`${BASE}/workout-days/:id`, async ({ params, request }) => {
    const body = (await request.json()) as WorkoutDayUpdateRequest
    const idx = db.workoutDays.findIndex((x) => x.id === params.id)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    const cur = db.workoutDays[idx]!
    db.workoutDays[idx] = {
      ...cur,
      date: body.date ?? cur.date,
      title: body.title !== undefined ? body.title : cur.title,
      notes: body.notes !== undefined ? body.notes : cur.notes,
      updatedAt: db.ts(),
    }
    return HttpResponse.json(db.workoutDays[idx])
  }),
  http.delete(`${BASE}/workout-days/:id`, ({ params }) => {
    const idx = db.workoutDays.findIndex((x) => x.id === params.id)
    if (idx !== -1) db.workoutDays.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── workout-records（日配下一覧 / upsert）──
  http.get(`${BASE}/workout-days/:workoutDayId/workout-records`, ({ params }) => {
    const recs = db.workoutRecords.filter((r) => r.workoutDayId === params.workoutDayId)
    return HttpResponse.json(recs)
  }),
  http.post(`${BASE}/workout-records`, async ({ request }) => {
    const body = (await request.json()) as WorkoutRecordUpsertRequest
    // UNIQUE(workout_day_id, exercise_id) 合流
    const merged = db.workoutRecords.find(
      (r) => r.workoutDayId === body.workoutDayId && r.exerciseId === body.exerciseId,
    )
    if (merged) return HttpResponse.json(merged)
    const created = {
      id: body.id,
      workoutDayId: body.workoutDayId,
      exerciseId: body.exerciseId,
      notes: body.notes ?? null,
      createdAt: db.ts(),
      updatedAt: db.ts(),
    }
    db.workoutRecords.push(created)
    return HttpResponse.json(created)
  }),
  http.get(`${BASE}/workout-records/:id`, ({ params }) => {
    const r = db.workoutRecords.find((x) => x.id === params.id)
    return r ? HttpResponse.json(r) : new HttpResponse(null, { status: 404 })
  }),
  http.delete(`${BASE}/workout-records/:id`, ({ params }) => {
    const idx = db.workoutRecords.findIndex((x) => x.id === params.id)
    if (idx !== -1) {
      db.workoutRecords.splice(idx, 1)
      // 配下のセットも除去
      for (let i = db.workoutSets.length - 1; i >= 0; i--) {
        if (db.workoutSets[i]!.workoutRecordId === params.id) db.workoutSets.splice(i, 1)
      }
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // ── workout-sets（実績配下）──
  http.get(`${BASE}/workout-records/:workoutRecordId/workout-sets`, ({ params }) => {
    const sets = db.workoutSets
      .filter((s) => s.workoutRecordId === params.workoutRecordId)
      .sort((a, b) => a.position - b.position)
    return HttpResponse.json(sets)
  }),
  http.post(`${BASE}/workout-records/:workoutRecordId/workout-sets`, async ({ params, request }) => {
    const body = (await request.json()) as WorkoutSetCreateRequest
    const existing = db.workoutSets.find((s) => s.id === body.id)
    if (existing) return HttpResponse.json(existing)
    const recordId = String(params.workoutRecordId)
    const maxPos = db.workoutSets
      .filter((s) => s.workoutRecordId === recordId)
      .reduce((m, s) => Math.max(m, s.position), -1)
    const created = {
      id: body.id,
      workoutRecordId: recordId,
      reps: body.reps,
      weight: body.weight,
      position: maxPos + 1,
      createdAt: db.ts(),
      updatedAt: db.ts(),
    }
    db.workoutSets.push(created)
    return HttpResponse.json(created)
  }),
  http.put(
    `${BASE}/workout-records/:workoutRecordId/workout-sets/reorder`,
    async ({ params, request }) => {
      const recordId = String(params.workoutRecordId)
      const body = (await request.json()) as WorkoutSetReorderRequest
      body.ids.forEach((id, index) => {
        const set = db.workoutSets.find(
          (s) => s.id === id && s.workoutRecordId === recordId,
        )
        if (set) set.position = index
      })
      const sets = db.workoutSets
        .filter((s) => s.workoutRecordId === recordId)
        .sort((a, b) => a.position - b.position)
      return HttpResponse.json(sets)
    },
  ),
  http.put(`${BASE}/workout-sets/:id`, async ({ params, request }) => {
    const body = (await request.json()) as WorkoutSetUpdateRequest
    const idx = db.workoutSets.findIndex((x) => x.id === params.id)
    if (idx === -1) return new HttpResponse(null, { status: 404 })
    const cur = db.workoutSets[idx]!
    db.workoutSets[idx] = {
      ...cur,
      reps: body.reps ?? cur.reps,
      weight: body.weight ?? cur.weight,
      updatedAt: db.ts(),
    }
    return HttpResponse.json(db.workoutSets[idx])
  }),
  http.delete(`${BASE}/workout-sets/:id`, ({ params }) => {
    const idx = db.workoutSets.findIndex((x) => x.id === params.id)
    if (idx !== -1) db.workoutSets.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
