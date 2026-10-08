/**
 * スプレッドシート「KINDLER 営業行動管理」からの仮取り込み口（GASが呼ぶ）。
 *
 * - 認証は専用の鍵 SHEET_IMPORT_TOKEN（Bearer）だけ。ログインセッションやService Roleキーは
 *   GAS側に持たせない。この鍵で書けるのは「法人案件」と「商談の活動ログ」だけ。
 * - 案件: ダッシュボードIDがあれば更新、なければ新規登録してIDを返す（GASがシートに書き戻す）。
 *   更新ではシートが空欄の項目とメモは触らない。
 * - 商談: 商談IDの目印がすでに活動ログにあれば何もしない（何度送っても二重登録しない）。
 * - 1回の呼び出しごとに mcp_audit_log に1行残す（/mcp-logs で見られる）。
 *
 * 最終的にMCPで直接記録する運用に移ったら、このルートと lib/sheet-import.ts を消し、鍵も削除する。
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  type SheetDealRow,
  type SheetMeetingRow,
  clean,
  meetingMarker,
  toDate,
  toDealFields,
  toMeetingNotes,
} from '@/lib/sheet-import'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 500
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function authorized(req: Request): boolean {
  const expected = process.env.SHEET_IMPORT_TOKEN?.trim()
  const header = req.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!expected || !given) return false
  // 長さの違いも含めて定数時間で比べる
  const a = createHash('sha256').update(expected).digest()
  const b = createHash('sha256').update(given).digest()
  return timingSafeEqual(a, b)
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

type DealResult = { row: number; dashboard_id?: string; action: 'created' | 'updated' | 'error'; error?: string }
type MeetingResult = { row: number; action: 'created' | 'exists' | 'skipped' | 'error'; error?: string }

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'サーバーの設定が不足しています' }, { status: 500 })
  }

  let body: { deals?: SheetDealRow[]; meetings?: SheetMeetingRow[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'JSONとして読めません' }, { status: 400 })
  }
  const deals = Array.isArray(body.deals) ? body.deals : []
  const meetings = Array.isArray(body.meetings) ? body.meetings : []
  if (deals.length + meetings.length > MAX_ROWS) {
    return Response.json({ error: `一度に送れるのは${MAX_ROWS}行までです` }, { status: 413 })
  }

  const db = admin()
  const { data: members, error: memberError } = await db.from('members').select('id, name')
  if (memberError) return Response.json({ error: memberError.message }, { status: 500 })
  const memberIdByName = new Map((members ?? []).map((m) => [String(m.name).trim(), String(m.id)]))

  // ---- 案件 ----
  const dealResults: DealResult[] = []
  for (const r of deals) {
    const id = clean(r.dashboard_id)
    try {
      if (id && !UUID.test(id)) throw new Error('ダッシュボードIDの形式が正しくありません')
      const { fields, error } = toDealFields(r, memberIdByName, !id)
      if (error) throw new Error(error)

      if (id) {
        const { data, error: e } = await db.from('deals_tob').update(fields).eq('id', id).select('id')
        if (e) throw new Error(e.message)
        if (!data || data.length === 0) throw new Error('このダッシュボードIDの案件が見つかりません（削除された可能性）')
        dealResults.push({ row: r.row, dashboard_id: id, action: 'updated' })
      } else {
        const { data, error: e } = await db.from('deals_tob').insert(fields).select('id').single()
        if (e) throw new Error(e.message)
        dealResults.push({ row: r.row, dashboard_id: data.id, action: 'created' })
      }
    } catch (e) {
      dealResults.push({ row: r.row, action: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  // ---- 商談（活動ログ） ----
  const meetingResults: MeetingResult[] = []
  for (const r of meetings) {
    const meetingId = clean(r.meeting_id)
    const dealId = clean(r.dashboard_id)
    try {
      if (!meetingId) throw new Error('商談IDが空です')
      if (!dealId) {
        meetingResults.push({ row: r.row, action: 'skipped', error: '紐づく案件のダッシュボードIDがありません（案件管理に先に登録してください）' })
        continue
      }
      if (!UUID.test(dealId)) throw new Error('ダッシュボードIDの形式が正しくありません')

      const { data: existing, error: e1 } = await db
        .from('deal_actions')
        .select('id')
        .eq('deal_id', dealId)
        .like('notes', `${meetingMarker(meetingId)}%`)
        .limit(1)
      if (e1) throw new Error(e1.message)
      if (existing && existing.length > 0) {
        meetingResults.push({ row: r.row, action: 'exists' })
        continue
      }

      const memberName = clean(r.member)
      const memberId = memberName ? memberIdByName.get(memberName) : undefined
      if (memberName && !memberId) throw new Error(`担当「${memberName}」がメンバーマスタにいません`)

      const { error: e2 } = await db.from('deal_actions').insert({
        deal_id: dealId,
        deal_type: 'tob',
        member_id: memberId ?? null,
        action_type: '商談',
        action_date: toDate(r.date) ?? new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10),
        notes: toMeetingNotes(r),
      })
      if (e2) throw new Error(e2.message)
      meetingResults.push({ row: r.row, action: 'created' })
    } catch (e) {
      meetingResults.push({ row: r.row, action: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  const count = <T extends { action: string }>(rs: T[], a: string) => rs.filter((x) => x.action === a).length
  const summary = {
    deals: { created: count(dealResults, 'created'), updated: count(dealResults, 'updated'), error: count(dealResults, 'error') },
    meetings: {
      created: count(meetingResults, 'created'),
      exists: count(meetingResults, 'exists'),
      skipped: count(meetingResults, 'skipped'),
      error: count(meetingResults, 'error'),
    },
  }

  // 実行ログ（失敗しても取り込み結果は返す）
  const errors = [...dealResults, ...meetingResults].filter((x) => x.action === 'error')
  await db
    .from('mcp_audit_log')
    .insert({
      actor: 'sheet-import',
      client: req.headers.get('user-agent')?.slice(0, 200) ?? null,
      user_request: 'スプレッドシート「KINDLER 営業行動管理」からの反映（GAS）',
      tool_name: 'sheet_import',
      args: { deals: deals.length, meetings: meetings.length },
      result_summary: JSON.stringify(summary),
      success: errors.length === 0,
      error_message: errors.length ? errors.slice(0, 5).map((x) => `${x.row}行目: ${x.error}`).join(' / ') : null,
    })
    .then(({ error }) => error && console.error('[import-sales-sheet] audit failed:', error.message))

  return Response.json({ summary, deals: dealResults, meetings: meetingResults })
}
