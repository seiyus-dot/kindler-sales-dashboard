import type { SupabaseClient } from '@supabase/supabase-js'

// ログインユーザーの権限。cookie（user_role / user_allowed_pages）は本人が書き換えられるので、
// 判定には必ずDBの権限表（allowed_emails）を security definer 関数 my_access() 経由で読む。
// cookie はサイドバーの表示の出し分けにだけ使う。
export type Access = {
  role: string
  allowedPages: string[]
  agencyId: string | null
}

export const AGENCY_REPORT_PATH = '/agency-report'

/**
 * - Access: 権限表に登録あり
 * - null:   権限表に登録なし（ログインさせない）
 * - undefined: my_access() がまだ無いなど判定できない（schema_ad_agencies.sql 実行前）→ 呼び出し側で従来どおりの動作
 */
export async function readAccess(supabase: SupabaseClient): Promise<Access | null | undefined> {
  const { data, error } = await supabase.rpc('my_access')
  if (error) return undefined
  if (!data) return null
  return {
    role: data.role ?? 'member',
    allowedPages: data.allowed_pages ?? ['/aicamp'],
    agencyId: data.agency_id ?? null,
  }
}

// 代理店アカウントが見られるのはレポートページだけ
export function pagesFor(access: Access): string[] {
  return access.agencyId ? [AGENCY_REPORT_PATH] : access.allowedPages
}
