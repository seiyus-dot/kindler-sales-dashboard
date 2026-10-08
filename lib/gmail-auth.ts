/**
 * 営業メンバー個人のGoogleログイン＋Gmail連携（サーバー側専用）
 *
 * MCP接続の認可画面で「Googleアカウントで接続」を選ぶと、
 *   1. Googleで本人確認（openid email）
 *   2. 本人のGmailへの権限（読み取り＋下書き作成/下書き送信）に同意
 * をまとめて行い、リフレッシュトークンを暗号化して gmail_tokens に保存する。
 * 以後のMCPツールは actor（＝メールアドレス）から本人のGmailクライアントを組み立てる。
 *
 * Googleのクライアント設定は Supabase のGoogleログインとは別に持つ
 * （GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET）。
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { google } from 'googleapis'
import { mcpSupabaseAdmin } from './mcp-supabase-admin'

export const GMAIL_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  // 下書きの作成・更新と、下書きの送信（drafts.send）に必要。任意のメールを直接送る gmail.send は要求しない
  'https://www.googleapis.com/auth/gmail.compose',
]

/** Googleログインを始めたブラウザと戻ってきたブラウザが同じかを確かめるcookie */
export const NONCE_COOKIE = 'mcp_google_nonce'

export function isGoogleLoginConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GMAIL_TOKEN_ENC_KEY
  )
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/oauth/google/callback`
}

export function googleOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri
  )
}

// ---------------------------------------------
// リフレッシュトークンの暗号化（AES-256-GCM）
// 鍵は GMAIL_TOKEN_ENC_KEY を SHA-256 で32バイトにしたもの。鍵を変えると全員再接続になる。
// ---------------------------------------------
function encKey(): Buffer {
  const raw = process.env.GMAIL_TOKEN_ENC_KEY
  if (!raw) throw new Error('GMAIL_TOKEN_ENC_KEY が設定されていません')
  return createHash('sha256').update(raw).digest()
}

function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.')
}

function decrypt(enc: string): string {
  const [iv, tag, body] = enc.split('.').map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', encKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

// ---------------------------------------------
// 接続できる人の判定
// allowed_emails（アプリの権限表）に登録があり、代理店アカウントでない社内メンバーだけ。
// 代理店は agency-report 以外に触れさせない方針のため、MCPにも入れない。
// ---------------------------------------------
export type McpUserAccess = { role: 'admin' | 'member' }

/** 接続を許すなら権限（admin/member）を、許さないならnullを返す */
export async function mcpUserAccess(email: string): Promise<McpUserAccess | null> {
  const { data, error } = await mcpSupabaseAdmin
    .from('allowed_emails')
    .select('email, role, agency_id')
    .eq('email', email)
    .maybeSingle()
  if (error || !data || data.agency_id) return null
  return { role: data.role === 'admin' ? 'admin' : 'member' }
}

export async function saveGmailToken(email: string, refreshToken: string, scope: string | null | undefined) {
  // 1人=1行の保存用途なので upsert を使う（mf_tokens と同じ）
  const { error } = await mcpSupabaseAdmin
    .from('gmail_tokens')
    .upsert({ email, refresh_token_enc: encrypt(refreshToken), scope: scope ?? null }, { onConflict: 'email' })
  if (error) throw new Error(`Gmail連携情報の保存に失敗しました: ${error.message}`)
}

export async function hasGmailToken(email: string): Promise<boolean> {
  const { data } = await mcpSupabaseAdmin.from('gmail_tokens').select('email').eq('email', email).maybeSingle()
  return Boolean(data)
}

export class GmailNotConnectedError extends Error {}

/** 本人のGmail APIクライアント。アクセストークンの更新はgoogleapisが自動で行う */
export async function gmailClientFor(email: string) {
  const { data, error } = await mcpSupabaseAdmin
    .from('gmail_tokens')
    .select('refresh_token_enc')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    throw new GmailNotConnectedError(
      `${email} のGmailは未連携です。MCPコネクタを一度切断し、「Googleアカウントで接続」でつなぎ直してください。`
    )
  }
  const auth = googleOAuthClient()
  auth.setCredentials({ refresh_token: decrypt(data.refresh_token_enc) })
  return google.gmail({ version: 'v1', auth })
}
