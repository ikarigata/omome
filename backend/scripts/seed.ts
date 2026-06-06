import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { muscleGroups } from '../src/db/schema.js'

const sql = neon(process.env.DIRECT_URL!)
const db = drizzle({ client: sql })

const MUSCLE_GROUPS = [
  { id: 'a1b2c3d4-0001-4001-8001-000000000001', name: '胸' },
  { id: 'a1b2c3d4-0002-4002-8002-000000000002', name: '肩' },
  { id: 'a1b2c3d4-0003-4003-8003-000000000003', name: '背中' },
  { id: 'a1b2c3d4-0004-4004-8004-000000000004', name: '腕' },
  { id: 'a1b2c3d4-0005-4005-8005-000000000005', name: '腹' },
  { id: 'a1b2c3d4-0006-4006-8006-000000000006', name: '脚' },
  { id: 'a1b2c3d4-0007-4007-8007-000000000007', name: 'その他' },
]

async function seed() {
  await db.insert(muscleGroups).values(MUSCLE_GROUPS).onConflictDoNothing()
  console.log('Seeded muscle_groups:', MUSCLE_GROUPS.map((m) => m.name).join(', '))
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
