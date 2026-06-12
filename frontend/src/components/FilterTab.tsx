/**
 * 部位フィルターなどに使う単一選択タブ（ピル型）。
 * 横スクロールの行に並べる前提で shrink-0 を持つ。
 */
export function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-sm transition-all ${
        active
          ? 'bg-interactive-primary text-content-inverse'
          : 'bg-surface-container text-content-inverse opacity-50'
      }`}
    >
      {label}
    </button>
  )
}
