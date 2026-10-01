import type { SupabaseClient } from '@supabase/supabase-js'

export const normalizeName = (s: string) => s.replace(/[\s　]/g, '')

export const isBlockedFriend = (f: { status?: string | null; blocked_at?: string | null }) =>
  !!f.blocked_at || !!f.status?.includes('ブロック')

// 友だち一覧（フォロー中のみ）と照合して、AI CAMP商談の「LINE追加確認」を未確認→確認済みにする。
//   1. LINE友だちID（UTAGE Webhook で取り込んだ申込）の完全一致
//   2. LINE名の一致。ただし同名の友だちが複数いる名前は取り違えを避けて対象外
// 確認済み→未確認には戻さない（担当者の手動チェックを消さないため）
export async function autoCheckLineAdded(supabase: SupabaseClient): Promise<number> {
  const [{ data: friends }, { data: pending }] = await Promise.all([
    supabase.from('line_friends').select('line_user_id, line_display_name, status, blocked_at'),
    supabase.from('aicamp_consultations').select('id, line_name, line_friend_id').eq('line_added', false),
  ])
  if (!friends || !pending?.length) return 0

  const following = friends.filter(f => !isBlockedFriend(f))
  const followingIds = new Set(following.map(f => f.line_user_id))

  const nameCount = new Map<string, number>()
  for (const f of friends) {
    if (!f.line_display_name) continue
    const n = normalizeName(f.line_display_name)
    nameCount.set(n, (nameCount.get(n) ?? 0) + 1)
  }
  const followingUniqueNames = new Set(
    following
      .filter(f => f.line_display_name && nameCount.get(normalizeName(f.line_display_name)) === 1)
      .map(f => normalizeName(f.line_display_name!)),
  )

  const ids = pending
    .filter(c =>
      (c.line_friend_id && followingIds.has(c.line_friend_id)) ||
      (c.line_name && followingUniqueNames.has(normalizeName(c.line_name))),
    )
    .map(c => c.id)
  if (ids.length === 0) return 0

  const { error } = await supabase.from('aicamp_consultations').update({ line_added: true }).in('id', ids)
  return error ? 0 : ids.length
}
