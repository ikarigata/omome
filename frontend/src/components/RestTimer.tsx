import { useEffect, useRef, useState } from 'react'

// セット間のレスト用カウントダウンタイマー。種目追加ボタンの下に常設する。
// 黒背景の自己完結コンポーネントで、ネットワークは触らない（純粋にローカル状態）。
// 状態は localStorage に永続化し、別画面への遷移（アンマウント）やリロードを
// またいでも継続する。実行中は「終了時刻(ms)」を保存しておき、復帰時に現在時刻
// との差から残り時間を再計算する。
const PRESETS = [60, 90, 120] as const
const DEFAULT_DURATION = 60
const STORAGE_KEY = 'omome.restTimer'
// 永続化は「レスト中に別画面を見て戻る」程度の短時間の橋渡しが目的。これより古い
// 保存状態（前回ワークアウトの残り等）は復元せず初期化する。
const STALE_MS = 30 * 60 * 1000

// 永続化する形。running 中は endAt（終了時刻ms）を、停止中は remaining（残り秒）を持つ。
// savedAt は保存時刻で、古い状態を捨てる判定に使う。
interface Persisted {
  duration: number
  running: boolean
  endAt?: number
  remaining?: number
  finished?: boolean
  savedAt: number
}

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

function savePersisted(p: Omit<Persisted, 'savedAt'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, savedAt: Date.now() }))
  } catch {
    /* localStorage 不可（プライベートモード等）でも続行 */
  }
}

// マウント時の初期状態を localStorage から復元する。実行中だった場合は終了時刻から
// 残り時間を再計算し、既に過ぎていれば「完了」状態にする。
function restoreInitialState(): {
  duration: number
  remaining: number
  running: boolean
  finished: boolean
} {
  const p = loadPersisted()
  // 未保存、または古すぎる（30分超 = 前回ワークアウト等）状態は捨てて初期値から始める。
  if (!p || !p.savedAt || Date.now() - p.savedAt > STALE_MS) {
    return { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION, running: false, finished: false }
  }
  if (p.running && p.endAt) {
    const left = Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000))
    return left > 0
      ? { duration: p.duration, remaining: left, running: true, finished: false }
      : { duration: p.duration, remaining: 0, running: false, finished: true }
  }
  return {
    duration: p.duration,
    remaining: p.remaining ?? p.duration,
    running: false,
    finished: p.finished ?? false,
  }
}

// 0 到達時の通知。iOS Safari など未対応環境もあるため全て best-effort（失敗は握りつぶす）。
function notifyDone() {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    /* vibrate 未対応でも続行 */
  }
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => void ctx.close()
  } catch {
    /* AudioContext 不可（自動再生制限等）でも続行 */
  }
}

export function RestTimer() {
  const initial = useRef(restoreInitialState()).current
  // duration = リセット時に戻す基準。remaining = 残り秒。
  const [duration, setDuration] = useState(initial.duration)
  const [remaining, setRemaining] = useState(initial.remaining)
  const [running, setRunning] = useState(initial.running)
  const [finished, setFinished] = useState(initial.finished)
  // 一時停止の影響を受けずに残り時間を正確に出すため、終了時刻(ms)基準で計算する。
  const endAtRef = useRef(0)

  useEffect(() => {
    if (!running) return
    // 開始/再開/復帰時に終了時刻を確定し、その時点で永続化する（アンマウントしても残る）。
    endAtRef.current = Date.now() + remaining * 1000
    savePersisted({ duration, running: true, endAt: endAtRef.current, finished: false })
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setRunning(false)
        setFinished(true)
        savePersisted({ duration, running: false, remaining: 0, finished: true })
        notifyDone()
      }
    }, 250)
    return () => window.clearInterval(id)
    // remaining は開始/再開時の初期値としてのみ参照する（毎秒の再生成は不要）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  function selectPreset(sec: number) {
    setRunning(false)
    setFinished(false)
    setDuration(sec)
    setRemaining(sec)
    savePersisted({ duration: sec, running: false, remaining: sec, finished: false })
  }

  function toggle() {
    if (remaining <= 0) return
    if (running) {
      // 一時停止：残り秒を保存しておく（再開時/復帰時の基準）。
      setRunning(false)
      savePersisted({ duration, running: false, remaining, finished: false })
    } else {
      setFinished(false)
      setRunning(true) // 終了時刻の確定と保存は running 用 effect が行う
    }
  }

  function reset() {
    setRunning(false)
    setFinished(false)
    setRemaining(duration)
    savePersisted({ duration, running: false, remaining: duration, finished: false })
  }

  return (
    <div className="rounded-xl bg-black p-4 text-white">
      <div className="mb-3 flex items-center justify-center gap-2">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => selectPreset(sec)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              duration === sec ? 'bg-white/25 font-bold' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {sec}秒
          </button>
        ))}
      </div>

      <div
        className={`text-center text-5xl font-bold tabular-nums ${
          finished ? 'text-content-accent' : 'text-white'
        }`}
        aria-live="polite"
      >
        {format(remaining)}
      </div>
      {finished && <p className="mt-1 text-center text-sm text-content-accent">休憩おわり！</p>}

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={remaining <= 0}
          className="rounded-lg bg-interactive-primary px-6 py-2 font-bold text-content-inverse transition-all hover:bg-interactive-hover active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          {running ? '一時停止' : '開始'}
        </button>
        <button
          type="button"
          aria-label="リセット"
          onClick={reset}
          className="rounded-lg bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
        >
          ⟲ リセット
        </button>
      </div>
    </div>
  )
}
