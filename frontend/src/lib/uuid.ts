// クライアント生成 UUID（冪等性の前提。CLAUDE.md 参照）。
// crypto.randomUUID() はセキュアコンテキスト（HTTPS / localhost）でしか公開されない。
// 開発では tailscale（http の *.ts.net）経由でアクセスするため非セキュアになり、
// randomUUID が undefined になる。getRandomValues は非セキュアでも使えるので、
// それを使った UUIDv4 フォールバックを用意して、どの経路でも ID 生成が動くようにする。
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return uuidv4FromRandomValues()
}

function uuidv4FromRandomValues(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // RFC 4122 準拠: version 4 と variant ビットを設定
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}
