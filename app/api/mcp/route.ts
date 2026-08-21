import { createMcpHandler } from 'mcp-handler'
import { registerMcpTools } from '@/lib/mcp-tools'
import { registerMfBillingTools } from '@/lib/mcp-mf-tools'
import { isValidAccessToken, originFrom } from '@/lib/mcp-oauth'

const ALLOWED_TOKENS = (process.env.MCP_AUTH_TOKENS ?? '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

const ALLOW_DELETE = process.env.MCP_ALLOW_DELETE === 'true'

const mcpHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server, { allowDelete: ALLOW_DELETE })
    registerMfBillingTools(server)
  },
  {},
  { basePath: '/api', verboseLogs: false }
)

function bearerToken(req: Request): string | undefined {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined
}

/**
 * 認証は2系統。
 * 1. MCP_AUTH_TOKENS の共有シークレットを直接Bearerで送る（Claude Desktop等、ヘッダを自分で設定できるクライアント）
 * 2. /api/oauth/* で発行したアクセストークン（ChatGPTのようにOAuthしか選べないクライアント）
 */
function isAuthorized(req: Request) {
  const token = bearerToken(req)
  if (!token) return false
  if (ALLOWED_TOKENS.length > 0 && ALLOWED_TOKENS.includes(token)) return true
  return isValidAccessToken(token)
}

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    // RFC 9728: 401には認可サーバの在り処を示すWWW-Authenticateを付ける。
    // これが無いとChatGPTはOAuthフローを開始できない。
    const origin = originFrom(req)
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    })
  }
  return mcpHandler(req)
}

export { handler as GET, handler as POST, handler as DELETE }
