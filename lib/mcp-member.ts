/**
 * MCPで接続している本人（Googleで接続したメールアドレス）を、メンバーマスタの行に引き当てる。
 *
 * 権限表（allowed_emails.name）はフルネーム（例「白岩 聖悠」）のことがあり、
 * メンバーマスタ（members.name）とシートの「設定」タブは名字（例「白岩」）で持っている。
 * そこで次の順で探す: 完全一致 → 空白で区切った先頭（名字）の一致 → 名字で始まる名前の一致（1人に決まる場合だけ）。
 * 決まらないとき（名前がずれている・共有キーでの接続など）は null。
 */
import { mcpSupabaseAdmin } from './mcp-supabase-admin'
import { isUserActor } from './mcp-oauth'

type Member = { id: string; name: string }

const normalize = (s: string) => s.replace(/[\s　]+/g, ' ').trim()

/** 権限表の名前からメンバーを1人に決める（テストしやすいよう純粋関数にしてある） */
export function matchMember(fullName: string, members: Member[]): Member | null {
  const name = normalize(fullName)
  if (!name) return null
  const byName = (n: string) => members.filter((m) => normalize(m.name) === n)

  const exact = byName(name)
  if (exact.length === 1) return exact[0]

  const surname = name.split(' ')[0]
  const bySurname = byName(surname)
  if (bySurname.length === 1) return bySurname[0]

  // 空白なしのフルネーム（例「白岩聖悠」）は、メンバー名で始まるものを探す
  const prefixed = members.filter((m) => normalize(m.name) && name.startsWith(normalize(m.name)))
  return prefixed.length === 1 ? prefixed[0] : null
}

/** 接続している本人のメンバー（members の行）。決まらなければ null */
export async function memberFor(actor: string): Promise<Member | null> {
  if (!isUserActor(actor)) return null
  const { data: allowed } = await mcpSupabaseAdmin.from('allowed_emails').select('name').eq('email', actor).maybeSingle()
  if (!allowed?.name) return null
  const { data: members } = await mcpSupabaseAdmin.from('members').select('id, name')
  return matchMember(String(allowed.name), (members ?? []) as Member[])
}

export async function memberIdFor(actor: string): Promise<string | null> {
  return (await memberFor(actor))?.id ?? null
}

/** シートの担当欄に書く名前（メンバーマスタの名前＝名字） */
export async function memberNameFor(actor: string): Promise<string | null> {
  return (await memberFor(actor))?.name ?? null
}
