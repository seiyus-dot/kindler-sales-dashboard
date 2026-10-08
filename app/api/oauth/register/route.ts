/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 *
 * ChatGPTは接続時にここへクライアント登録を投げてくる。
 * このサーバは「共有シークレットを知っているか」だけで認可を判断するため、
 * クライアントの識別に意味はない。登録は受理して client_id を返すだけにする
 * （client_secretは発行しない＝パブリッククライアント。実際の防御はPKCEと
 *  認可画面での共有シークレット入力が担う）。
 */
import { randomUUID } from 'node:crypto'
import { isAcceptableRedirectUri } from '@/lib/mcp-oauth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // ボディ無しでも登録は通す
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : []
  // 許可していない戻り先のクライアントは登録の時点で断る（認可画面でも同じ判定で弾く）
  const rejected = redirectUris.filter((u) => !isAcceptableRedirectUri(u))
  if (rejected.length > 0) {
    return Response.json(
      { error: 'invalid_redirect_uri', error_description: `許可されていないredirect_uriです: ${rejected.join(', ')}` },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
    )
  }

  return Response.json(
    {
      client_id: `mcp-${randomUUID()}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: typeof body.client_name === 'string' ? body.client_name : 'MCP Client',
    },
    {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    }
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
