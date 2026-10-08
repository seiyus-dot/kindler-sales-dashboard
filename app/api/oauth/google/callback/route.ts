/**
 * Googleの同意画面からの戻り先。
 * 本人確認（IDトークン検証）→ 権限表で社内メンバーか確認 → Gmailのリフレッシュトークンを暗号化保存
 * → actor=メールアドレスの認可コードを発行して MCPクライアントの redirect_uri へ戻す。
 */
import { NextResponse } from 'next/server'
import { issueAuthorizationCode, originFrom, verifyGoogleLoginState } from '@/lib/mcp-oauth'
import {
  GMAIL_SCOPES,
  googleOAuthClient,
  googleRedirectUri,
  NONCE_COOKIE,
  mcpUserAccess,
  saveGmailToken,
} from '@/lib/gmail-auth'

export const dynamic = 'force-dynamic'

function failPage(message: string, status = 400): Response {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>接続できませんでした | KINDLER</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fb;padding:24px;
font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2937}
.card{max-width:420px;background:#fff;border-radius:14px;padding:32px;box-shadow:0 8px 32px rgba(26,58,110,.10)}
h1{margin:0 0 10px;font-size:18px;color:#b91c1c}p{margin:0;font-size:13px;line-height:1.7;color:#4b5563}</style>
</head><body><div class="card"><h1>接続できませんでした</h1><p>${message
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')}</p></div></body></html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

function clearNonce(res: Response): Response {
  const r = res instanceof NextResponse ? res : new NextResponse(res.body, res)
  r.cookies.set(NONCE_COOKIE, '', { maxAge: 0, path: '/api/oauth/google' })
  return r
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const loginState = verifyGoogleLoginState(url.searchParams.get('state') ?? '')
  if (!loginState) return failPage('接続の有効期限が切れました。もう一度最初からやり直してください。')

  const cookieNonce = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NONCE_COOKIE}=`))
    ?.slice(NONCE_COOKIE.length + 1)
  if (!cookieNonce || cookieNonce !== loginState.nonce) {
    return failPage('接続を始めたブラウザと同じブラウザで操作してください。')
  }

  if (url.searchParams.get('error')) {
    // 同意画面で「キャンセル」された場合はMCPクライアントにそのまま伝える
    const back = new URL(loginState.redirectUri)
    back.searchParams.set('error', 'access_denied')
    if (loginState.state) back.searchParams.set('state', loginState.state)
    return clearNonce(NextResponse.redirect(back.toString(), 302))
  }

  const code = url.searchParams.get('code') ?? ''
  const client = googleOAuthClient(googleRedirectUri(originFrom(req)))

  let email: string
  let refreshToken: string | null | undefined
  let grantedScope: string | undefined
  try {
    const { tokens } = await client.getToken(code)
    if (!tokens.id_token) throw new Error('IDトークンがありません')
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) throw new Error('メールアドレスを確認できません')
    email = payload.email.toLowerCase()
    refreshToken = tokens.refresh_token
    grantedScope = tokens.scope
  } catch (e) {
    console.error('[oauth/google/callback] token exchange failed:', e instanceof Error ? e.message : e)
    return failPage('Googleでの本人確認に失敗しました。もう一度お試しください。')
  }

  if (!(await mcpUserAccess(email))) {
    return failPage(`${email} は営業ダッシュボードの利用者として登録されていません。管理者に招待を依頼してください。`, 403)
  }

  // Gmailの権限のチェックを外して同意された場合は、ログインだけ通しても使えないので止める
  const granted = new Set((grantedScope ?? '').split(' '))
  const missing = GMAIL_SCOPES.filter((s) => s.startsWith('https://') && !granted.has(s))
  if (missing.length > 0) {
    return failPage('Gmailへのアクセス許可がオフになっています。同意画面ですべての項目にチェックを入れて接続し直してください。')
  }
  if (!refreshToken) {
    return failPage('Googleから連携情報を受け取れませんでした。もう一度お試しください。')
  }

  try {
    await saveGmailToken(email, refreshToken, grantedScope)
  } catch (e) {
    console.error('[oauth/google/callback]', e instanceof Error ? e.message : e)
    return failPage('連携情報の保存に失敗しました。管理者に連絡してください。', 500)
  }

  const authCode = issueAuthorizationCode({
    redirectUri: loginState.redirectUri,
    codeChallenge: loginState.codeChallenge,
    codeChallengeMethod: loginState.codeChallengeMethod,
    actor: email,
  })
  const back = new URL(loginState.redirectUri)
  back.searchParams.set('code', authCode)
  if (loginState.state) back.searchParams.set('state', loginState.state)
  return clearNonce(NextResponse.redirect(back.toString(), 302))
}
