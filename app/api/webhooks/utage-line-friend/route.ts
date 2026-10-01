import { NextRequest, NextResponse } from 'next/server'
import { createWebhookAdminClient, readWebhookBody, verifyWebhookToken } from '@/lib/utage-webhook'
import { autoCheckLineAdded } from '@/lib/line-check'

// UTAGE「LINE配信」シナリオの登録時アクション（Webhook）から呼ばれ、line_friends を最新化して
// AI CAMP商談の「LINE追加確認」を自動で確認済みにする。CSV取込（/api/import-line-friends）と同じ列・ステータス表記に揃える。
// event=block を付けたアクションから呼ばれた場合はブロックとして記録する（確認済み→未確認には戻さない）。
// 認証は URL の ?token=（lib/utage-webhook.ts 参照）。

export const dynamic = 'force-dynamic'

const STATUS_FOLLOWING = 'フォロー中 - 配信対象'
const STATUS_BLOCKED = 'ブロック中 - 配信対象'

export async function POST(req: NextRequest) {
  if (!verifyWebhookToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createWebhookAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' }, { status: 500 })
  }

  const body = await readWebhookBody(req)
  const lineId = body.line_id
  if (!lineId) {
    return NextResponse.json({ error: 'line_id がありません' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const blocked = body.event === 'block'
  const fields = {
    status: blocked ? STATUS_BLOCKED : STATUS_FOLLOWING,
    blocked_at: blocked ? now : null,
    ...(body.line_name ? { line_display_name: body.line_name } : {}),
    ...(body.tracking ? { registration_source: body.tracking } : {}),
  }

  const { data: existing } = await supabase
    .from('line_friends')
    .select('id')
    .eq('line_user_id', lineId)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('line_friends').update(fields).eq('id', existing.id)
    : await supabase.from('line_friends').insert({ line_user_id: lineId, registered_at: now, ...fields })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const autoChecked = blocked ? 0 : await autoCheckLineAdded(supabase)
  return NextResponse.json({ ok: true, created: !existing, autoChecked })
}
