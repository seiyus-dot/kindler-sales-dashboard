import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// MCPツール用の管理クライアント。Service Roleキーを使うためRLSをバイパスする。
// /api/mcp をBearerトークンで保護すること（app/api/mcp/route.ts参照）。
export const mcpSupabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})
