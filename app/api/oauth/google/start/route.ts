/**
 * MCP接続の「Googleアカウントで接続」入口。
 * MCPクライアントから受け取った認可パラメータを署名付きstateに詰めて、Googleの同意画面へ送る。
 */
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { isAcceptableRedirectUri, issueGoogleLoginState, originFrom } from '@/lib/mcp-oauth'
import {
  GMAIL_SCOPES,
  NONCE_COOKIE,
  googleOAuthClient,
  googleRedirectUri,
  isGoogleLoginConfigured,
} from '@/lib/gmail-auth'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const url = new URL(req.url)
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  if (!isAcceptableRedirectUri(redirectUri)) {
    return new Response('redirect_uri が不正です', { status: 400 })
  }
  if (!isGoogleLoginConfigured()) {
    return new Response('Googleアカウントでの接続はまだ設定されていません。管理者に連絡してください。', { status: 503 })
  }

  const nonce = randomBytes(16).toString('base64url')
  const state = issueGoogleLoginState({
    redirectUri,
    state: url.searchParams.get('state') ?? '',
    codeChallenge: url.searchParams.get('code_challenge') ?? '',
    codeChallengeMethod: url.searchParams.get('code_challenge_method') ?? 'S256',
    nonce,
  })

  const authUrl = googleOAuthClient(googleRedirectUri(originFrom(req))).generateAuthUrl({
    access_type: 'offline',
    // リフレッシュトークンを毎回確実に受け取るため、同意画面を必ず出す
    prompt: 'consent',
    include_granted_scopes: true,
    scope: GMAIL_SCOPES,
    state,
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
