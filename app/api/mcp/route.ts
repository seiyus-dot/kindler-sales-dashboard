import { createMcpHandler } from 'mcp-handler'
import { registerMcpTools } from '@/lib/mcp-tools'
import { registerMfBillingTools } from '@/lib/mcp-mf-tools'
import { registerMfInvoiceWriteTools } from '@/lib/mcp-mf-write-tools'
import { registerMfPartnerWriteTools } from '@/lib/mcp-mf-partner-tools'
import { registerMfItemTools } from '@/lib/mcp-mf-item-tools'
import { registerMfQuoteTools } from '@/lib/mcp-mf-quote-tools'
import { registerGmailTools } from '@/lib/mcp-gmail-tools'
import { registerSheetTools } from '@/lib/mcp-sheet-tools'
import { AUDIT_INSTRUCTIONS, withAuditLog } from '@/lib/mcp-audit'
import { actorFromAccessToken, isUserActor, originFrom, resolveSharedSecretActor } from '@/lib/mcp-oauth'
import { mcpUserAccess } from '@/lib/gmail-auth'

const ALLOW_DELETE = process.env.MCP_ALLOW_DELETE === 'true'
const ALLOW_MF_WRITE = process.env.MCP_ALLOW_MF_WRITE === 'true'

/**
 * 接続者によってツールの範囲を分ける。
 * - full:   共有の接続キー（管理者が配布）と、Googleで接続した admin。CRM・MF請求・Gmailすべて
 * - member: Googleで接続した一般メンバー。CRM＋本人のGmail＋営業行動管理シートだけ（MFの請求・取引先データには触れない）
 * 一覧（tools/list）にも出さないよう、ハンドラごと分けている。
 * どちらも全ツールの実行を mcp_audit_log に記録する（lib/mcp-audit.ts、管理者は /mcp-logs で閲覧）。
 */
const fullHandler = createMcpHandler(
  (rawServer) => {
    const server = withAuditLog(rawServer)
    registerMcpTools(server, { allowDelete: ALLOW_DELETE })
    registerMfBillingTools(server)
    registerMfInvoiceWriteTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerMfPartnerWriteTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerMfItemTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerMfQuoteTools(server, { allowWrite: ALLOW_MF_WRITE })
    registerGmailTools(server)
    registerSheetTools(server)
  },
  { instructions: AUDIT_INSTRUCTIONS },
  { basePath: '/api', verboseLogs: false }
)

const memberHandler = createMcpHandler(
  (rawServer) => {
    const server = withAuditLog(rawServer)
    registerMcpTools(server, { allowDelete: ALLOW_DELETE })
    registerGmailTools(server)
    registerSheetTools(server)
  },
  { instructions: AUDIT_INSTRUCTIONS },
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
 *    認可画面で「Googleアカウントで接続」を選んだ場合、actorは本人のメールアドレスになり
 *    Gmailツール（lib/mcp-gmail-tools.ts）が本人のGmailで動く。
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
  let actor = resolveActor(req)
  let role: 'admin' | 'member' = 'admin' // 共有の接続キーは管理者扱い
  // Googleで接続したメンバーは毎回権限表を引き直す。外れた時点で使えなくなり、権限の変更もすぐ反映される
  if (actor && isUserActor(actor)) {
    const access = await mcpUserAccess(actor)
    if (access) role = access.role
    else actor = null
  }
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
  return role === 'admin' ? fullHandler(req) : memberHandler(req)
}

export { handler as GET, handler as POST, handler as DELETE }
