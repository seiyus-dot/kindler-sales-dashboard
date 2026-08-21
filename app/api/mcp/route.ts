import { createMcpHandler } from 'mcp-handler'
import { registerMcpTools } from '@/lib/mcp-tools'
import { registerMfBillingTools } from '@/lib/mcp-mf-tools'

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

function isAuthorized(req: Request) {
  if (ALLOWED_TOKENS.length === 0) return false
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
  return !!token && ALLOWED_TOKENS.includes(token)
}

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return mcpHandler(req)
}

export { handler as GET, handler as POST, handler as DELETE }
