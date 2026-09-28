/**
 * MoneyForward連携MCPツールの書き込み系操作の実行履歴（誰が・何を・いつ）。
 * schema_mf_write_audit_log.sql の mf_write_audit_log に記録する。
 *
 * 監査ログの失敗で本処理（実際のMF API呼び出し）を止めてはいけないため、
 * 呼び出し側は必ずawaitせず投げっぱなしにするか、失敗を無視すること。
 */
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/** MCPツール呼び出しのextraからactor（接続トークンのラベル）を取り出す。無ければ'unknown' */
export function actorFrom(extra: { authInfo?: { clientId?: string } } | undefined): string {
  return extra?.authInfo?.clientId || 'unknown'
}

export async function logMfWrite(entry: {
  tool: string
  action: string
  actor: string
  targetType?: string
  targetId?: string | null
  success: boolean
  error?: string
  summary?: Record<string, unknown>
}): Promise<void> {
  try {
    const sb = admin()
    const { error } = await sb.from('mf_write_audit_log').insert({
      tool_name: entry.tool,
      action: entry.action,
      actor: entry.actor,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      success: entry.success,
      error_message: entry.error ?? null,
      summary: entry.summary ?? null,
    })
    if (error) console.error('[mf-write-audit] insert failed:', error.message)
  } catch (e) {
    console.error('[mf-write-audit] failed to log:', e instanceof Error ? e.message : e)
  }
}
