import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readAccess, type Access } from '@/lib/access'

// 広告代理店向けレポート。代理店アカウントは自社分の「集計」だけを受け取る（申込者の氏名などは返さない）。
// 社内メンバーは全代理店を切り替えて見られる。代理店アカウントは社内テーブルを直接読めないので、
// 権限を確認したうえで Service Role で集計する。

export const dynamic = 'force-dynamic'

const CONDUCTED = ['成約', '失注', '保留', 'クーリングオフ']
const CANCELLED = ['ドタキャン', 'キャンセル']

type Agency = { id: string; name: string; slug: string; source_values: string[]; uses_fb_ads: boolean; sort_order: number }

type WeekRow = {
  week_start: string
  week_end: string
  spend: number
  list_count: number | null
  consultations: number
  seated: number
  won: number
  cancelled: number
  spend_id?: string
  notes?: string | null
}

function sessionClient(req: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
  })
}

function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } })
}

// 呼び出し元の権限。代理店アカウントなら自社の代理店IDに固定される
async function resolveCaller(req: NextRequest): Promise<{ email: string; access: Access } | null> {
  const supabase = sessionClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const access = await readAccess(supabase)
  if (!access) return null
  return { email: user.email, access }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const jstDate = (ts: string) => ymd(new Date(new Date(ts).getTime() + 9 * 3600 * 1000))
const normalize = (s: string | null) => (s ?? '').normalize('NFKC').replace(/\s/g, '')

// 月にかかる月曜始まりの週
function weeksOf(month: string): { week_start: string; week_end: string }[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  const start = new Date(first)
  start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7))
  const out = []
  for (let d = start; d <= last; d = new Date(d.getTime() + 7 * 86400000)) {
    out.push({ week_start: ymd(d), week_end: ymd(new Date(d.getTime() + 6 * 86400000)) })
  }
  return out
}

export async function GET(req: NextRequest) {
  const caller = await resolveCaller(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = adminClient()
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' }, { status: 500 })

  const month = /^\d{4}-\d{2}$/.test(req.nextUrl.searchParams.get('month') ?? '')
    ? req.nextUrl.searchParams.get('month')!
    : jstDate(new Date().toISOString()).slice(0, 7)

  const { data: allAgencies, error: agErr } = await db.from('ad_agencies').select('*').order('sort_order')
  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 })
  const agencies = ((allAgencies ?? []) as Agency[]).filter(a => !caller.access.agencyId || a.id === caller.access.agencyId)
  const agency = agencies.find(a => a.slug === req.nextUrl.searchParams.get('agency')) ?? agencies.at(0)
  if (!agency) return NextResponse.json({ error: '代理店が見つかりません' }, { status: 404 })

  const weeks = weeksOf(month)
  const rangeStart = weeks.at(0)!.week_start
  const rangeEnd = weeks.at(-1)!.week_end
  const inMonth = (d: string) => d.startsWith(month)

  // ---- 広告費・リスト数 ----
  let fbRows: { day: string; ad_set_name: string; amount_spent: number; registrations_completed: number }[] = []
  let spendRows: { id: string; week_start: string; week_end: string; spend: number; list_count: number | null; notes: string | null }[] = []
  if (agency.uses_fb_ads) {
    const { data } = await db.from('fb_ads')
      .select('day, ad_set_name, amount_spent, registrations_completed')
      .gte('day', rangeStart).lte('day', rangeEnd).limit(10000)
    fbRows = data ?? []
  } else {
    const { data } = await db.from('ad_agency_spend')
      .select('id, week_start, week_end, spend, list_count, notes')
      .eq('agency_id', agency.id).gte('week_start', rangeStart).lte('week_start', rangeEnd)
    spendRows = data ?? []
  }

  // ---- 面談（この代理店の流入経路のものだけ）----
  const consultations: { status: string | null; consultation_date: string | null; registration_source: string | null }[] = []
  if (agency.source_values.length) {
    const { data } = await db.from('aicamp_consultations')
      .select('status, consultation_date, registration_source')
      .in('source', agency.source_values)
      .gte('consultation_date', `${rangeStart}T00:00:00+09:00`)
      .lte('consultation_date', `${rangeEnd}T23:59:59+09:00`)
      .limit(10000)
    consultations.push(...(data ?? []))
  }

  const weekRows: WeekRow[] = weeks.map(w => {
    const inWeek = (d: string) => d >= w.week_start && d <= w.week_end
    const cs = consultations.filter(c => c.consultation_date && inWeek(jstDate(c.consultation_date)))
    const fb = fbRows.filter(r => inWeek(r.day))
    const manual = spendRows.find(r => r.week_start === w.week_start)
    return {
      ...w,
      spend: agency.uses_fb_ads ? Math.round(fb.reduce((s, r) => s + (r.amount_spent ?? 0), 0)) : manual?.spend ?? 0,
      list_count: agency.uses_fb_ads ? fb.reduce((s, r) => s + (r.registrations_completed ?? 0), 0) : manual?.list_count ?? null,
      consultations: cs.length,
      seated: cs.filter(c => CONDUCTED.includes(c.status ?? '')).length,
      won: cs.filter(c => c.status === '成約').length,
      cancelled: cs.filter(c => CANCELLED.includes(c.status ?? '')).length,
      ...(manual ? { spend_id: manual.id, notes: manual.notes } : {}),
    }
  })

  // ---- 月の合計（週の端数は日付で月内に限定）----
  const monthCs = consultations.filter(c => c.consultation_date && inMonth(jstDate(c.consultation_date)))
  const monthFb = fbRows.filter(r => inMonth(r.day))
  const totals = {
    spend: agency.uses_fb_ads
      ? Math.round(monthFb.reduce((s, r) => s + (r.amount_spent ?? 0), 0))
      : spendRows.filter(r => inMonth(r.week_start)).reduce((s, r) => s + r.spend, 0),
    list_count: agency.uses_fb_ads
      ? monthFb.reduce((s, r) => s + (r.registrations_completed ?? 0), 0)
      : spendRows.filter(r => inMonth(r.week_start)).reduce((s, r) => s + (r.list_count ?? 0), 0),
    consultations: monthCs.length,
    seated: monthCs.filter(c => CONDUCTED.includes(c.status ?? '')).length,
    won: monthCs.filter(c => c.status === '成約').length,
    cancelled: monthCs.filter(c => CANCELLED.includes(c.status ?? '')).length,
    pending: monthCs.filter(c => (c.status ?? '予定') === '予定' || c.status === '保留').length,
  }

  // ---- 広告セット別（fb_ads 連携の代理店のみ）----
  const adSets = agency.uses_fb_ads
    ? [...new Set(monthFb.map(r => r.ad_set_name.trim()))].map(name => {
        const rows = monthFb.filter(r => r.ad_set_name.trim() === name)
        const cs = monthCs.filter(c => normalize(c.registration_source) === normalize(name))
        return {
          name,
          spend: Math.round(rows.reduce((s, r) => s + (r.amount_spent ?? 0), 0)),
          list_count: rows.reduce((s, r) => s + (r.registrations_completed ?? 0), 0),
          consultations: cs.length,
          won: cs.filter(c => c.status === '成約').length,
        }
      }).filter(a => a.spend > 0 || a.consultations > 0).sort((a, b) => b.spend - a.spend)
    : []

  return NextResponse.json({
    month,
    agencies: agencies.map(a => ({ slug: a.slug, name: a.name, uses_fb_ads: a.uses_fb_ads })),
    agency: { slug: agency.slug, name: agency.name, uses_fb_ads: agency.uses_fb_ads },
    canSwitch: !caller.access.agencyId,
    totals,
    weeks: weekRows,
    adSets,
  })
}

// 手入力の週次広告費（fb_ads を使わない代理店）。代理店アカウントは自社分だけ編集できる
export async function PUT(req: NextRequest) {
  const caller = await resolveCaller(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = adminClient()
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' }, { status: 500 })

  const body = await req.json().catch(() => null) as
    { agency?: string; week_start?: string; week_end?: string; spend?: number; list_count?: number | null; notes?: string | null } | null
  if (!body?.agency || !/^\d{4}-\d{2}-\d{2}$/.test(body.week_start ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(body.week_end ?? '')) {
    return NextResponse.json({ error: 'agency / week_start / week_end が必要です' }, { status: 400 })
  }
  const spend = Number(body.spend)
  if (!Number.isFinite(spend) || spend < 0) return NextResponse.json({ error: '広告費は0以上の数値で入力してください' }, { status: 400 })

  const { data: agency } = await db.from('ad_agencies').select('id, uses_fb_ads').eq('slug', body.agency).maybeSingle()
  if (!agency) return NextResponse.json({ error: '代理店が見つかりません' }, { status: 404 })
  if (caller.access.agencyId && caller.access.agencyId !== agency.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (agency.uses_fb_ads) return NextResponse.json({ error: 'この代理店の広告費は自動連携です' }, { status: 400 })

  const fields = {
    week_end: body.week_end,
    spend: Math.round(spend),
    list_count: body.list_count == null || body.list_count === ('' as unknown) ? null : Math.round(Number(body.list_count)),
    notes: body.notes?.trim() || null,
    updated_by: caller.email,
    updated_at: new Date().toISOString(),
  }
  const { data: existing } = await db.from('ad_agency_spend')
    .select('id').eq('agency_id', agency.id).eq('week_start', body.week_start).maybeSingle()
  const { error } = existing
    ? await db.from('ad_agency_spend').update(fields).eq('id', existing.id)
    : await db.from('ad_agency_spend').insert({ agency_id: agency.id, week_start: body.week_start, ...fields })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
