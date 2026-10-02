import { NextRequest, NextResponse, after } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createWebhookAdminClient } from '@/lib/utage-webhook'
import { normalizeName } from '@/lib/line-check'
import { isSalesReport, parseSalesReport, type SalesReport } from '@/lib/sales-report'

// Slack Events API（message.channels）から呼ばれ、「#101_2c_営業成果報告部屋」の商談報告を
// aicamp_consultations（UTAGE申込Webhookで作られた面談）に反映し、結果を投稿のスレッドに返信する。
// 認証は Slack の署名（SLACK_SIGNING_SECRET）。対象チャンネルは SLACK_2C_REPORT_CHANNEL_ID。
// 投稿を編集した場合も読み直す（書き方の誤りを直せば反映される）。

export const dynamic = 'force-dynamic'

type SlackMessage = { text?: string; ts?: string; thread_ts?: string; bot_id?: string; subtype?: string }
type SlackEvent = SlackMessage & { type?: string; channel?: string; message?: SlackMessage; previous_message?: SlackMessage }

function verifySlackSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim()
  const ts = req.headers.get('x-slack-request-timestamp')
  const sig = req.headers.get('x-slack-signature')
  if (!secret || !ts || !sig) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false
  const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function replyInThread(channel: string, threadTs: string, text: string) {
  const token = process.env.SLACK_BOT_TOKEN?.trim()
  if (!token) return
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, thread_ts: threadTs, text }),
  })
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00+09:00`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}
const jstLabel = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const nameKey = (s: string | null | undefined) => normalizeName(s ?? '').replace(/様$/, '').replace(/髙/g, '高')

type Row = { id: string; name: string | null; line_name: string | null; consultation_date: string; member_id: string | null; contract_date: string | null }

// 商談日の面談からお客様名で探す。見つからなければ前後7日に広げる。
// 完全一致 → 名字だけなどの部分一致の順。候補が複数なら取り違えを避けて決めない
async function findConsultation(db: SupabaseClient, r: SalesReport): Promise<{ row?: Row; candidates: Row[] }> {
  const key = nameKey(r.customer)
  for (const [from, to] of [[0, 1], [-7, 8]]) {
    const { data } = await db
      .from('aicamp_consultations')
      .select('id, name, line_name, consultation_date, member_id, contract_date')
      .gte('consultation_date', addDays(r.date!, from))
      .lt('consultation_date', addDays(r.date!, to))
      .order('consultation_date')
    const rows = (data ?? []) as Row[]
    const exact = rows.filter(c => [c.name, c.line_name].some(n => n && nameKey(n) === key))
    if (exact.length === 1) return { row: exact[0], candidates: [] }
    const partial = rows.filter(c => [c.name, c.line_name].some(n => n && (nameKey(n).includes(key) || key.includes(nameKey(n)))))
    if (exact.length === 0 && partial.length === 1) return { row: partial[0], candidates: [] }
    if (exact.length > 1 || partial.length > 1) return { candidates: exact.length ? exact : partial }
  }
  return { candidates: [] }
}

// 見つからなかったときに、名前の書き間違いに気づけるよう商談日の面談一覧を出す
async function sameDayConsultations(db: SupabaseClient, date: string): Promise<Row[]> {
  const { data } = await db
    .from('aicamp_consultations')
    .select('id, name, line_name, consultation_date, member_id, contract_date')
    .gte('consultation_date', addDays(date, 0))
    .lt('consultation_date', addDays(date, 1))
    .order('consultation_date')
  return (data ?? []) as Row[]
}

async function handleReport(db: SupabaseClient, channel: string, ts: string, text: string) {
  const r = parseSalesReport(text)
  if (r.problems.length) {
    await replyInThread(channel, ts, `読み取れなかった項目があります。投稿を編集して直すと、もう一度読み込みます。\n・${r.problems.join('\n・')}`)
    return
  }

  const { row, candidates } = await findConsultation(db, r)
  if (!row) {
    const toList = (rows: Row[]) => rows.map(c => `・${c.name ?? c.line_name}（${jstLabel(c.consultation_date)}）`).join('\n')
    if (candidates.length) {
      await replyInThread(channel, ts, `「${r.customer}」様に当てはまる面談が複数あり、決められませんでした。お客様名をフルネームにして投稿を編集してください。\n${toList(candidates)}`)
    } else {
      const sameDay = await sameDayConsultations(db, r.date!)
      await replyInThread(
        channel,
        ts,
        `${r.date} 前後に「${r.customer}」様の面談が見つかりませんでした。申込時のお名前と同じ表記にして投稿を編集するか、アプリで面談を登録してください。` +
          (sameDay.length ? `\n${r.date} の面談：\n${toList(sameDay)}` : ''),
      )
    }
    return
  }

  const update: Record<string, unknown> = { status: r.status }
  if (r.reason) update.reason = r.reason
  if (r.paymentMethod) update.payment_method = r.paymentMethod
  if (r.paymentCount) update.payment_count = r.paymentCount
  if (r.nextDate) update.reply_deadline = r.nextDate
  if (r.status === '成約') {
    if (r.amount) update.contract_amount = r.amount
    if (!row.contract_date) update.contract_date = r.date
  }
  if (!row.member_id && r.member) {
    const { data: members } = await db.from('members').select('id, name')
    const m = members?.find(x => nameKey(x.name) === nameKey(r.member))
    if (m) update.member_id = m.id
  }

  const { error } = await db.from('aicamp_consultations').update(update).eq('id', row.id)
  if (error) {
    await replyInThread(channel, ts, `アプリへの反映に失敗しました（${error.message}）。お手数ですがアプリで更新してください。`)
    return
  }
  const detail = [
    r.status,
    r.status === '成約' && r.amount ? `${r.amount.toLocaleString()}円` : null,
    r.paymentMethod,
    r.paymentCount ? `${r.paymentCount}回` : null,
    r.nextDate ? `次回 ${r.nextDate.slice(5).replace('-', '/')}` : null,
  ].filter(Boolean).join('／')
  const warn = r.status === '成約' && !r.amount ? '\n※金額が無いため契約金額は更新していません。「■金額：550,000円」を足して編集してください。' : ''
  await replyInThread(channel, ts, `アプリに反映しました：${row.name ?? row.line_name} 様（${jstLabel(row.consultation_date)}）→ ${detail}${warn}`)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifySlackSignature(req, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = JSON.parse(rawBody) as { type?: string; challenge?: string; event?: SlackEvent }

  if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge })
  // Slack は3秒以内に返さないと再送してくる。再送分は処理済みとして無視
  if (req.headers.get('x-slack-retry-num')) return NextResponse.json({ ok: true })

  const event = body.event
  if (body.type !== 'event_callback' || event?.type !== 'message') return NextResponse.json({ ok: true })
  if (event.channel !== process.env.SLACK_2C_REPORT_CHANNEL_ID) return NextResponse.json({ ok: true })

  // 新規投稿か、投稿の編集（message_changed）だけを読む。Bot（自分の返信を含む）とスレッド内の返信は対象外
  const msg: SlackMessage | undefined = event.subtype === 'message_changed' ? event.message : event.subtype ? undefined : event
  if (!msg?.text || !msg.ts || msg.bot_id) return NextResponse.json({ ok: true })
  if (msg.thread_ts && msg.thread_ts !== msg.ts) return NextResponse.json({ ok: true })
  // リンクのプレビュー展開なども message_changed で届く。本文が変わっていなければ読み直さない
  if (event.subtype === 'message_changed' && event.previous_message?.text === msg.text) return NextResponse.json({ ok: true })
  if (!isSalesReport(msg.text)) return NextResponse.json({ ok: true })

  const db = createWebhookAdminClient()
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' }, { status: 500 })

  const channel = event.channel!
  const { ts, text } = msg as { ts: string; text: string }
  after(() => handleReport(db, channel, ts, text).catch(e => console.error('slack-sales-report', e)))
  return NextResponse.json({ ok: true })
}
