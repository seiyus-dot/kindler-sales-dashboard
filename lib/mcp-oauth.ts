/**
 * MCP用の最小 OAuth 2.1 認可サーバ（サーバー側専用）
 *
 * なぜ必要か:
 * ChatGPTのカスタムMCPコネクタは認証方式として OAuth / 認証なし / 両方 しか選べず、
 * 「APIキー（固定Bearerトークン）」を直接設定できない。一方このサーバの実質的な
 * 認証情報は MCP_AUTH_TOKENS の共有シークレットである。
 * そこで「認可画面で共有シークレットを入力させ、正しければトークンを発行する」だけの
 * 最小限のOAuthサーバを被せ、ChatGPTの要求仕様に適合させる。
 * セキュリティ強度は共有シークレットそのものと同じで、それ以上でも以下でもない。
 *
 * 状態を持たない設計:
 * 認可コード・アクセストークン・リフレッシュトークンはすべてHMAC-SHA256で署名した
 * 自己完結型の文字列にしてあり、DBテーブルを増やさずに済ませている。
 * 署名鍵は MCP_OAUTH_SECRET、無ければ MCP_AUTH_TOKENS から導出する
 * （＝共有シークレットを差し替えると既存の接続は自動的に無効になる）。
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const CODE_TTL_SEC = 600 // 認可コードは10分
const ACCESS_TTL_SEC = 60 * 60 * 24 * 30 // アクセストークンは30日
const REFRESH_TTL_SEC = 60 * 60 * 24 * 365 // リフレッシュトークンは1年

/** Vercelの環境変数にクォート付きで保存されてしまう事故が多いので剥がしておく */
function stripQuotes(v: string): string {
  const t = v.trim()
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1).trim()
  }
  return t
}

/**
 * MCP_AUTH_TOKENS は "label:secret" 形式のカンマ区切りに対応する（ラベル無しの
 * 素の値も従来どおり有効）。ラベルは「誰の接続か」の識別子として監査ログに残す。
 */
type SharedSecretEntry = { label: string; secret: string }

function parseAuthTokenEntries(): SharedSecretEntry[] {
  return (process.env.MCP_AUTH_TOKENS ?? '')
    .split(',')
    .map(stripQuotes)
    .filter(Boolean)
    .map((entry): SharedSecretEntry => {
      const idx = entry.indexOf(':')
      if (idx > 0) {
        const label = entry.slice(0, idx).trim()
        const secret = entry.slice(idx + 1).trim()
        if (label && secret) return { label, secret }
      }
      return { label: 'default', secret: entry }
    })
}

export function allowedSharedSecrets(): string[] {
  return parseAuthTokenEntries().map((e) => e.secret)
}

/** 共有シークレットとして正しいか（長さの違いも定数時間で吸収する） */
export function isValidSharedSecret(candidate: string): boolean {
  return resolveSharedSecretActor(candidate) !== null
}

/** 一致した接続キーのラベル（＝誰の接続か）を返す。一致しなければnull */
export function resolveSharedSecretActor(candidate: string): string | null {
  const entries = parseAuthTokenEntries()
  let matched: string | null = null
  for (const e of entries) {
    const a = Buffer.from(sha256Hex(e.secret), 'utf8')
    const b = Buffer.from(sha256Hex(candidate), 'utf8')
    if (a.length === b.length && timingSafeEqual(a, b)) matched = e.label
  }
  return matched
}

function sha256Hex(v: string): string {
  return createHmac('sha256', 'mcp-oauth-compare').update(v).digest('hex')
}

function signingKey(): string {
  const explicit = process.env.MCP_OAUTH_SECRET
  if (explicit) return explicit
  const derived = allowedSharedSecrets().join('|')
  if (!derived) throw new Error('MCP_AUTH_TOKENS も MCP_OAUTH_SECRET も設定されていません')
  return `derived:${derived}`
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url')
}

/** {payload}.{signature} 形式のトークンを作る */
function issue(kind: string, data: Record<string, unknown>, ttlSec: number): string {
  const body = { ...data, kind, exp: Math.floor(Date.now() / 1000) + ttlSec }
  const payload = b64url(JSON.stringify(body))
  return `${payload}.${sign(payload)}`
}

/** 署名と有効期限を検証してペイロードを返す。不正なら null */
function verify(kind: string, token: string): Record<string, unknown> | null {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  let expected: string
  try {
    expected = sign(payload)
  } catch {
    return null
  }
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
    if (body.kind !== kind) return null
    if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null
    return body
  } catch {
    return null
  }
}

// ---------------------------------------------
// 認可コード（PKCEのcode_challengeを埋め込んで持ち回る）
// ---------------------------------------------
export function issueAuthorizationCode(args: {
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  actor: string
}): string {
  return issue(
    'code',
    { ru: args.redirectUri, cc: args.codeChallenge, ccm: args.codeChallengeMethod, ac: args.actor },
    CODE_TTL_SEC
  )
}

export function verifyAuthorizationCode(
  code: string
): { redirectUri: string; codeChallenge: string; codeChallengeMethod: string; actor: string } | null {
  const body = verify('code', code)
  if (!body) return null
  return {
    redirectUri: String(body.ru ?? ''),
    codeChallenge: String(body.cc ?? ''),
    codeChallengeMethod: String(body.ccm ?? 'S256'),
    actor: String(body.ac ?? 'default'),
  }
}

/** PKCE: code_verifier が code_challenge と対応しているか */
export function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  if (!challenge) return true // チャレンジ無しで発行したコードは検証をスキップ
  if (method === 'plain') return verifier === challenge
  const digest = createHash('sha256').update(verifier).digest('base64url')
  return digest === challenge
}

// ---------------------------------------------
// アクセストークン / リフレッシュトークン
// ---------------------------------------------
export function issueAccessToken(actor: string): string {
  return issue('access', { ac: actor }, ACCESS_TTL_SEC)
}

export function issueRefreshToken(actor: string): string {
  return issue('refresh', { ac: actor }, REFRESH_TTL_SEC)
}

export function isValidAccessToken(token: string): boolean {
  return verify('access', token) !== null
}

/** アクセストークンに埋め込まれたactor（接続ラベル）を取り出す。無効なら null */
export function actorFromAccessToken(token: string): string | null {
  const body = verify('access', token)
  if (!body) return null
  return String(body.ac ?? 'default')
}

export function isValidRefreshToken(token: string): boolean {
  return verify('refresh', token) !== null
}

/** リフレッシュトークンに埋め込まれたactor（接続ラベル）を取り出す。無効なら null */
export function actorFromRefreshToken(token: string): string | null {
  const body = verify('refresh', token)
  if (!body) return null
  return String(body.ac ?? 'default')
}

export const ACCESS_TOKEN_TTL_SEC = ACCESS_TTL_SEC

/**
 * リクエストから発行元のオリジンを求める。
 * Vercelのプレビュー/本番どちらでも正しいissuerを返すため、ホストはヘッダから取る。
 */
export function originFrom(req: Request): string {
  const url = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const host = forwardedHost ?? url.host
  const proto = forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
