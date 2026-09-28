import { createMcpHandler } from 'mcp-handler'
import { registerMcpTools } from '@/lib/mcp-tools'
import { registerMfBillingTools } from '@/lib/mcp-mf-tools'
import { registerMfInvoiceWriteTools } from '@/lib/mcp-mf-write-tools'
import { registerMfPartnerWriteTools } from '@/lib/mcp-mf-partner-tools'
import { registerMfItemTools } from '@/lib/mcp-mf-item-tools'
import { registerMfQuoteTools } from '@/lib/mcp-mf-quote-tools'
import { actorFromAccessToken, originFrom, resolveSharedSecretActor } from '@/lib/mcp-oauth'

const ALLOW_DELETE = process.env.MCP_ALLOW_DELETE === 'true'
const ALLOW_MF_WRITE = process.env.MCP_ALLOW_MF_WRITE === 'true'

const mcpHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server, { allowDelete: ALLOW_DELETE })
    registerMfBillingTools(server)
    registerMfInvoiceWriteTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerMfPartnerWriteTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerMfItemTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerMfQuoteTools(server, { allowWrite: ALLOW_MF_WRITE })
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
 *
 * どちらの経路でも、一致した接続キーのラベル（actor）を「誰の接続か」として
 * req.auth に載せる。mcp-handlerがこれをMCPツール呼び出しのextra.authInfoまで
 * 転送するので、書き込み系ツールの監査ログ（lib/mf-write-audit.ts）で使う。
 */
function resolveActor(req: Request): string | null {
  const token = bearerToken(req)
  if (!token) return null
  return resolveSharedSecretActor(token) ?? actorFromAccessToken(token)
}

async function handler(req: Request) {
  const actor = resolveActor(req)
  if (!actor) {
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
  ;(req as Request & { auth?: { token: string; clientId: string; scopes: string[] } }).auth = {
    token: bearerToken(req)!,
    clientId: actor,
    scopes: ['mcp'],
  }
  return mcpHandler(req)
}

export { handler as GET, handler as POST, handler as DELETE }
