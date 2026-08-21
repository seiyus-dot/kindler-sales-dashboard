/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * ChatGPTは /.well-known/oauth-protected-resource を見て「この保護資源の認可サーバはどこか」を知る。
 * next.config.ts の rewrites で /.well-known/... からここへ流している。
 */
import { originFrom } from '@/lib/mcp-oauth'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const origin = originFrom(req)
  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
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
