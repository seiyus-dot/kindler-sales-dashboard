/**
 * マネーフォワード クラウドAPI OAuth 2.0 ヘルパー（サーバー側専用）
 *
 * 公式: https://invoice.moneyforward.com/docs/api/v3/
 * - Authorization endpoint: https://api.biz.moneyforward.com/authorize
 * - Token endpoint:         https://api.biz.moneyforward.com/token
 * - Client認証: Basic（CLIENT_SECRET_BASIC）
 */
import { createClient } from '@supabase/supabase-js'

export const MF_AUTH_BASE = 'https://api.biz.moneyforward.com'
export const MF_INVOICE_API_BASE = 'https://invoice.moneyforward.com/api/v3'

// 請求書（見積・請求）操作に必要なスコープ。複数スコープはスペース区切り。
export const MF_SCOPES = 'mfc/invoice/data.write mfc/invoice/data.read'

const SCOPE_LABEL = 'default'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`環境変数 ${name} が設定されていません`)
  return v
}

function redirectUri(): string {
  return process.env.MF_REDIRECT_URI || 'http://localhost:3000/api/auth/mf/callback'
}

function basicAuthHeader(): string {
  const credentials = `${env('MF_CLIENT_ID')}:${env('MF_CLIENT_SECRET')}`
  return 'Basic ' + Buffer.from(credentials, 'utf8').toString('base64')
}

function admin() {
  return createClient(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}

// =============================================
// 1. 認可URL生成
// =============================================
export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('MF_CLIENT_ID'),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: MF_SCOPES,
    state,
  })
  return `${MF_AUTH_BASE}/authorize?${params.toString()}`
}

// =============================================
// 2. 認可コードをトークンに交換
// =============================================
type MFTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCodeForToken(code: string): Promise<MFTokenResponse> {
  const res = await fetch(`${MF_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Authorization': basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }).toString(),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MF token exchange failed (${res.status}): ${text}`)
  }
  return (await res.json()) as MFTokenResponse
}

// =============================================
// 3. リフレッシュトークンでアクセストークン更新
// =============================================
export async function refreshAccessToken(refreshToken: string): Promise<MFTokenResponse> {
  const res = await fetch(`${MF_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Authorization': basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MF token refresh failed (${res.status}): ${text}`)
  }
  return (await res.json()) as MFTokenResponse
}

// =============================================
// 4. トークン保存（DB upsert）
// =============================================
export async function saveTokens(
  tokens: MFTokenResponse,
  connectedBy?: string | null,
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const sb = admin()
  const payload: Record<string, unknown> = {
    scope_label: SCOPE_LABEL,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope,
  }
  if (connectedBy) payload.connected_by = connectedBy
  const { error } = await sb.from('mf_tokens').upsert(payload, { onConflict: 'scope_label' })
  if (error) throw new Error(`mf_tokens upsert failed: ${error.message}`)
}

// =============================================
// 5. 接続ステータス取得（UI表示用）
// =============================================
export type MFConnectionStatus =
  | { connected: false }
  | { connected: true; expiresAt: string; scope: string | null; updatedAt: string }

export async function getConnectionStatus(): Promise<MFConnectionStatus> {
  const sb = admin()
  const { data } = await sb
    .from('mf_tokens')
    .select('expires_at, scope, updated_at')
    .eq('scope_label', SCOPE_LABEL)
    .maybeSingle()
  if (!data) return { connected: false }
  return {
    connected: true,
    expiresAt: data.expires_at,
    scope: data.scope,
    updatedAt: data.updated_at,
  }
}

// =============================================
// 6. 有効なアクセストークンを取得（必要なら自動リフレッシュ）
//    Phase 2-B 以降のAPI呼び出しで使う
// =============================================
export async function getValidAccessToken(): Promise<string> {
  const sb = admin()
  const { data, error } = await sb
    .from('mf_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('scope_label', SCOPE_LABEL)
    .maybeSingle()
  if (error) throw new Error(`mf_tokens read failed: ${error.message}`)
  if (!data) throw new Error('マネーフォワードに未接続です。先に /contracts から連携してください。')

  const expiresAt = new Date(data.expires_at).getTime()
  // 残り60秒未満ならリフレッシュ
  if (expiresAt - Date.now() > 60_000) {
    return data.access_token
  }
  const fresh = await refreshAccessToken(data.refresh_token)
  await saveTokens(fresh)
  return fresh.access_token
}

// =============================================
// 7. 切断（トークン削除）
// =============================================
export async function disconnect(): Promise<void> {
  const sb = admin()
  const { error } = await sb.from('mf_tokens').delete().eq('scope_label', SCOPE_LABEL)
  if (error) throw new Error(`mf_tokens delete failed: ${error.message}`)
}
