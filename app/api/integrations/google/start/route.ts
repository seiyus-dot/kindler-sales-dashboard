/**
 * 連携ページの「Googleを許可する」の入口。
 * ダッシュボードにログイン中の本人として、今の機能に必要なGoogleの権限をまとめて求める。
 * 戻り先は MCP接続と同じ /api/oauth/google/callback（state の種類で見分ける）。
 */
import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-check'
import { issueGoogleLinkState, originFrom } from '@/lib/mcp-oauth'
import {
  GMAIL_SCOPES,
  NONCE_COOKIE,
  googleOAuthClient,
  googleRedirectUri,
  isGoogleLoginConfigured,
  mcpUserAccess,
} from '@/lib/gmail-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  const email = user?.email?.toLowerCase()
  if (!email) return NextResponse.redirect(new URL('/login', req.url))
  if (!(await mcpUserAccess(email))) return NextResponse.redirect(new URL('/integrations?error=forbidden', req.url))
  if (!isGoogleLoginConfigured()) return NextResponse.redirect(new URL('/integrations?error=not_configured', req.url))

  const nonce = randomBytes(16).toString('base64url')
  const authUrl = googleOAuthClient(googleRedirectUri(originFrom(req))).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    login_hint: email,
    scope: GMAIL_SCOPES,
    state: issueGoogleLinkState({ email, nonce }),
  })

  const res = NextResponse.redirect(authUrl, 302)
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth/google',
  })
  return res
}
