import { NextRequest, NextResponse } from 'next/server'
import { createWebhookAdminClient, readWebhookBody, verifyWebhookToken } from '@/lib/utage-webhook'
import { isBlockedFriend, normalizeName } from '@/lib/line-check'

// UTAGE「イベント・予約」の申込時アクション（Webhook）から呼ばれ、aicamp_consultations に面談予定を1件作る。
// 認証は URL の ?token=（lib/utage-webhook.ts 参照）。

export const dynamic = 'force-dynamic'

const ASUKA_EVENT_PATTERN = /あすか/
// Meta広告の広告セット名（UTAGE の登録経路名と同じ命名）: 「（LP3-13 ASC ...）...」
const META_AD_SET_PATTERN = /^[\s\t]*[（(]\s*LP\d/

// 「2026-10-05」「2026/10/5」「2026年10月5日(日) 20:00〜」などから JST の timestamptz を作る
function parseConsultationDate(date: string, time: string): string | null {
  const d = date.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!d) return null
  const t = (time || date).match(/(\d{1,2}):(\d{2})/)
  const pad = (s: string) => s.padStart(2, '0')
  const hh = t ? pad(t[1]) : '00'
  const mm = t ? t[2] : '00'
  return `${d[1]}-${pad(d[2])}-${pad(d[3])}T${hh}:${mm}:00+09:00`
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createWebhookAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' }, { status: 500 })
  }

  const body = await readWebhookBody(req)
  const applicantId = body.applicant_id
  if (!applicantId) {
    return NextResponse.json({ error: 'applicant_id がありません' }, { status: 400 })
  }

  // 同じ申込の再送は何もしない
  const { data: existing } = await supabase
    .from('aicamp_consultations')
    .select('id')
    .eq('utage_applicant_id', applicantId)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, duplicate: true, id: existing.id })

  const eventName = body.event_name ?? ''
  const tracking = body.tracking ?? ''
  const name = (body.name || `${body.sei ?? ''} ${body.mei ?? ''}`.trim()) || null

  // LINE友だちIDが付いて届く＝申込者がUTAGE上でLINE連携済み。友だち一覧でブロック中なら確認済みにしない
  const lineId = body.line_id || null
  let lineAdded = false
  if (lineId) {
    const { data: friend } = await supabase
      .from('line_friends')
      .select('status, blocked_at')
      .eq('line_user_id', lineId)
      .maybeSingle()
    lineAdded = !friend || !isBlockedFriend(friend)
  }
  const consultationDate = parseConsultationDate(
    body.event_date || body.event_schedule || '',
    body.event_time || '',
  )

  let source: string | null = null
  if (ASUKA_EVENT_PATTERN.test(eventName)) {
    source = '自社SNS'
  } else if (tracking) {
    const { count } = await supabase
      .from('fb_ads')
      .select('day', { count: 'exact', head: true })
      .eq('ad_set_name', tracking)
    if ((count ?? 0) > 0 || META_AD_SET_PATTERN.test(tracking)) source = 'Meta広告'
  }

  const payload = {
    utage_applicant_id: applicantId,
    utage_event_name: eventName || null,
    applied_at: new Date().toISOString(),
    email: body.email || null,
    phone: body.phone || null,
    line_friend_id: lineId,
    registration_source: tracking || null,
    source,
  }

  // 担当者が先に手入力していた行（同じ氏名×同じ面談日時）があれば、新規作成せずに紐づける
  if (name && consultationDate) {
    const { data: candidates } = await supabase
      .from('aicamp_consultations')
      .select('id, name, source, registration_source, line_name, line_added')
      .eq('consultation_date', consultationDate)
      .is('utage_applicant_id', null)
    const manual = candidates?.find(c => c.name && normalizeName(c.name) === normalizeName(name))
    if (manual) {
      const { error } = await supabase
        .from('aicamp_consultations')
        .update({
          ...payload,
          // 手入力済みの流入経路は上書きしない
          source: manual.source ?? payload.source,
          registration_source: manual.registration_source ?? payload.registration_source,
          line_name: manual.line_name ?? (body.line_name || null),
          line_added: manual.line_added || lineAdded,
        })
        .eq('id', manual.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, linked: true, id: manual.id })
    }
  }

  const { data: inserted, error } = await supabase
    .from('aicamp_consultations')
    .insert({
      ...payload,
      name,
      line_name: body.line_name || null,
      line_added: lineAdded,
      consultation_date: consultationDate,
      status: '予定',
      service_type: 'AI CAMP',
    })
    .select('id')
    .single()

  if (error) {
    // 同時に2回届いた場合はユニーク制約で弾かれる → 重複として成功扱い
    if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: inserted.id })
}
