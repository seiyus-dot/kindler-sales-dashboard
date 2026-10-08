/**
 * MCPで接続している本人（Googleで接続したメールアドレス）を、メンバーマスタの行に引き当てる。
 * 「権限表の名前（allowed_emails.name）＝メンバーマスタの名前（members.name）」で対応づける。
 * 名前がずれている・共有キーでの接続などで決まらないときは null。
 */
import { mcpSupabaseAdmin } from './mcp-supabase-admin'
import { isUserActor } from './mcp-oauth'

export async function memberIdFor(actor: string): Promise<string | null> {
  if (!isUserActor(actor)) return null
  const { data: allowed } = await mcpSupabaseAdmin.from('allowed_emails').select('name').eq('email', actor).maybeSingle()
  if (!allowed?.name) return null
  const { data: member } = await mcpSupabaseAdmin.from('members').select('id').eq('name', allowed.name).maybeSingle()
  return member?.id ?? null
}
