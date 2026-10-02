import { NextRequest, NextResponse } from 'next/server'
import { createWebhookAdminClient } from '@/lib/utage-webhook'

// 代理店のシート（Adveronix出力）にある Apps Script から呼ばれ、fb_ads にその代理店の広告数値を取り込む。
// 認証は URL の ?token= = ad_agencies.ingest_token。合言葉が示す代理店の行しか書き込めない
// （代理店のシートに Service Role の鍵を置かないため）。広告1・広告2とも委託先のシートなので、全代理店この口から取り込む。

export const dynamic = 'force-dynamic'

type InRow = {
  day?: string; ad_set_name?: string; campaign_name?: string; ad_name?: string
  reach?: number; impressions?: number; amount_spent?: number; link_clicks?: number; registrations_completed?: number
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (token.length < 32) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createWebhookAdminClient()
  if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が未設定です' }, { status: 500 })

  const { data: agency } = await db.from('ad_agencies').select('slug').eq('ingest_token', token).maybeSingle()
  if (!agency) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { rows?: InRow[] } | null
  const input = (body?.rows ?? []).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(String(r.day ?? '')) && String(r.ad_set_name ?? '').trim())
  if (input.length > 20000) return NextResponse.json({ error: '一度に送れるのは20,000行までです' }, { status: 400 })

  // 同じ日×広告セットに広告が複数行あれば合算（CPM/CPC/CTRは合算値から再計算）
  const map = new Map<string, Required<Pick<InRow, 'day' | 'ad_set_name'>> & { campaign_name: string; ad_names: Set<string>; reach: number; impressions: number; amount_spent: number; link_clicks: number; registrations_completed: number }>()
  for (const r of input) {
    const day = String(r.day), ad_set_name = String(r.ad_set_name).trim()
    const key = `${day}\t${ad_set_name}`
    const a = map.get(key) ?? { day, ad_set_name, campaign_name: String(r.campaign_name ?? ''), ad_names: new Set<string>(), reach: 0, impressions: 0, amount_spent: 0, link_clicks: 0, registrations_completed: 0 }
    a.reach += num(r.reach); a.impressions += num(r.impressions); a.amount_spent += num(r.amount_spent)
    a.link_clicks += num(r.link_clicks); a.registrations_completed += num(r.registrations_completed)
    if (r.ad_name) a.ad_names.add(String(r.ad_name))
    map.set(key, a)
  }

  // 他の代理店の行（同じ日×広告セット名）は上書きしない
  const days = [...new Set([...map.values()].map(a => a.day))]
  const taken = new Set<string>()
  for (let i = 0; i < days.length; i += 200) {
    const { data } = await db.from('fb_ads').select('day, ad_set_name').in('day', days.slice(i, i + 200)).neq('agency_slug', agency.slug).limit(20000)
    for (const r of data ?? []) taken.add(`${r.day}\t${String(r.ad_set_name).trim()}`)
  }

  const rows = [...map.entries()].filter(([k]) => !taken.has(k)).map(([, a]) => ({
    agency_slug: agency.slug,
    day: a.day,
    ad_set_name: a.ad_set_name,
    campaign_name: a.campaign_name,
    reach: a.reach,
    impressions: a.impressions,
    amount_spent: round2(a.amount_spent),
    link_clicks: a.link_clicks,
    registrations_completed: a.registrations_completed,
    cpm: a.impressions ? round2(a.amount_spent / a.impressions * 1000) : 0,
    cpc: a.link_clicks ? round2(a.amount_spent / a.link_clicks) : 0,
    ctr: a.impressions ? round2(a.link_clicks / a.impressions * 100) : 0,
    ad_name: [...a.ad_names].join(' / '),
  }))

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('fb_ads').upsert(rows.slice(i, i + 500), { onConflict: 'day,ad_set_name' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, agency: agency.slug, saved: rows.length, skipped: map.size - rows.length })
}
