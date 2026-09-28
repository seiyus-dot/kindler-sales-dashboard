/**
 * OAuth 2.0 Token Endpoint
 * authorization_code（PKCE検証あり）と refresh_token に対応する。
 */
import {
  ACCESS_TOKEN_TTL_SEC,
  actorFromRefreshToken,
  isValidRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  verifyAuthorizationCode,
  verifyPkce,
} from '@/lib/mcp-oauth'

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }

function oauthError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: CORS })
}

async function readParams(req: Request): Promise<URLSearchParams> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await req.json()) as Record<string, unknown>
    return new URLSearchParams(
      Object.entries(json).map(([k, v]) => [k, String(v ?? '')])
    )
  }
  return new URLSearchParams(await req.text())
}

export async function POST(req: Request) {
  const params = await readParams(req)
  const grantType = params.get('grant_type')

  if (grantType === 'refresh_token') {
    const refresh = params.get('refresh_token') ?? ''
    if (!isValidRefreshToken(refresh)) {
      return oauthError('invalid_grant', 'リフレッシュトークンが無効か期限切れです')
    }
    const actor = actorFromRefreshToken(refresh) ?? 'default'
    return Response.json(
      {
        access_token: issueAccessToken(actor),
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SEC,
        refresh_token: issueRefreshToken(actor),
        scope: 'mcp',
      },
      { headers: CORS }
    )
  }

  if (grantType !== 'authorization_code') {
    return oauthError('unsupported_grant_type', `grant_type "${grantType}" には対応していません`)
  }

  const code = params.get('code') ?? ''
  const parsed = verifyAuthorizationCode(code)
  if (!parsed) {
    return oauthError('invalid_grant', '認可コードが無効か期限切れです')
  }

  // 認可コードを発行したときのredirect_uriと一致することを確認する
  const redirectUri = params.get('redirect_uri')
  if (redirectUri && redirectUri !== parsed.redirectUri) {
    return oauthError('invalid_grant', 'redirect_uri が認可時と一致しません')
  }

  const verifier = params.get('code_verifier') ?? ''
  if (!verifyPkce(verifier, parsed.codeChallenge, parsed.codeChallengeMethod)) {
    return oauthError('invalid_grant', 'PKCEの検証に失敗しました')
  }

  return Response.json(
    {
      access_token: issueAccessToken(parsed.actor),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: issueRefreshToken(parsed.actor),
      scope: 'mcp',
    },
    { headers: CORS }
  )
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
