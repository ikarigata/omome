// 開発時のみ有効なフラグ。本番ビルドでは未設定 = false。
export const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

// 認証バイパス時は API をモック（MSW）で賄う。実バックエンド/Cognito は不要。
export const USE_MOCKS = DEV_BYPASS_AUTH
