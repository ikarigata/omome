import type { QueryClient } from '@tanstack/react-query'

// 種目の派生集約（統計の progress / 履歴の history）は、セット・記録の書き込みで
// 内容が変わる。これらは workoutRecordId 経由で複数の種目に跨りうるため、書き込み後は
// 該当しうる集約クエリ（`['exercises', <id>, 'progress' | 'history']`）をまとめて
// 無効化する。履歴・統計画面はマウント時に再取得され、最新の内容で表示される。
// （[[set-save-keep-and-retry]] の方針どおり書き込み自体の自動リトライはしない。
// ここで行うのは無効化＝表示の整合性確保のみ。）
export function invalidateExerciseAggregates(qc: QueryClient) {
  void qc.invalidateQueries({
    predicate: (q) =>
      q.queryKey[0] === 'exercises' &&
      (q.queryKey[2] === 'progress' || q.queryKey[2] === 'history'),
  })
}
