/**
 * 接続設定の突き合わせ用の診断エンドポイント。
 *
 * 「接続キーが違います」になったとき、Vercelの環境変数に何が入っているかを
 * 直接読む手段が無いと切り分けられない。かといって値そのものを返すのは論外なので、
 * 食い違いの判定に必要な最小限（設定の有無・個数・文字数）だけを返す。
 * 文字数が分かれば「そもそも別の値」「クォートが付いている」等は即座に判別できる。
 *
 * 秘密そのもの・その一部・ハッシュは一切返さないこと。
 */
import { allowedSharedSecrets } from '@/lib/mcp-oauth'

export const dynamic = 'force-dynamic'

export function GET() {
  const secrets = allowedSharedSecrets()
  const raw = process.env.MCP_AUTH_TOKENS ?? ''

  return Response.json(
    {
      mcp_auth_tokens: {
        configured: secrets.length > 0,
        count: secrets.length,
        // 値は返さない。長さだけで期待値との一致を確認する。
        lengths: secrets.map((s) => s.length),
        raw_length: raw.length,
        had_surrounding_quotes: raw.trim() !== raw.split(',').map((s) => s.trim()).join(','),
      },
      mcp_allow_delete: process.env.MCP_ALLOW_DELETE === 'true',
      mcp_oauth_secret_configured: Boolean(process.env.MCP_OAUTH_SECRET),
      mf_credentials_configured: {
        client_id: Boolean(process.env.MF_CLIENT_ID),
        client_secret: Boolean(process.env.MF_CLIENT_SECRET),
      },
      supabase_service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      deployed_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
