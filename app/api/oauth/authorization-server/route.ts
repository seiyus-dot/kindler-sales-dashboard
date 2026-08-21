/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * ChatGPTは /.well-known/oauth-authorization-server を見て authorize/token/register の場所を知る。
 */
import { originFrom } from '@/lib/mcp-oauth'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const origin = originFrom(req)
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      // パブリッククライアント（client_secretを持たない）+ PKCE を前提にする
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['mcp'],
    },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
  )
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
