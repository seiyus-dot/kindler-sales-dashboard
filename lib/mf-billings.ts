/**
 * マネーフォワード クラウド請求書 API v3 の「請求書の読み取り」ラッパー（サーバー側専用）
 *
 * 発行系（createQuote / createBilling）は lib/mf-invoice.ts。こちらは参照専用で、
 * 入金予測（キャッシュフローの入り側）を組み立てるために使う。
 *
 * 実APIの仕様メモ（2026-08-21 実地検証。ドキュメントと食い違う点があるので注意）:
 * - payment_status は '0'〜'4' ではなく日本語文字列（'未設定' / '入金済み' 等）が返る
 * - 日付は 'YYYY/MM/DD' のスラッシュ区切り
 * - 金額は '100000.0' のような小数付き文字列
 * - レスポンスは { data: Billing[], pagination: { total_pages, ... } }
 */
import { MF_INVOICE_API_BASE, getValidAccessToken } from './mf-auth'

// 期間絞り込みの軸。入金予測では due_date（支払期日）を使う。
export const BILLING_RANGE_KEYS = ['billing_date', 'due_date', 'sales_date', 'created_at', 'updated_at'] as const
export type BillingRangeKey = (typeof BILLING_RANGE_KEYS)[number]

/** 入金済みとみなす payment_status（これ以外は未入金として予測に載せる） */
const PAID_STATUSES = new Set(['入金済み', '入金済', '振込済み', '振込済'])

/**
 * 集計から除外する請求書。
 * - 自社宛（取引先名に KINDLER を含む）は売上ではないため常に除外
 * - EXCLUDED_BILLING_IDS は個別に除外指定されたもの
 */
const SELF_PARTNER_PATTERNS = ['KINDLER']
const EXCLUDED_BILLING_IDS = new Set<string>([
  'EF8CCqiM7YDHXukU_mRK2w', // 鹿児島実業高等学校PTA / AIセミナー御請求書 400,000円（重複のため除外）
])

type RawBilling = {
  id: string
  partner_id?: string
  partner_name?: string
  title?: string
  billing_number?: string
  billing_date?: string
  due_date?: string
  sales_date?: string
  payment_status?: string
  subtotal_price?: string
  excise_price?: string
  total_price?: string
  pdf_url?: string
}

export type Billing = {
  id: string
  partner_id: string | null
  partner_name: string
  title: string
  billing_date: string | null
  due_date: string | null
  sales_date: string | null
  payment_status: string
  is_paid: boolean
  /** 税抜（円） */
  subtotal: number
  /** 消費税（円） */
  tax: number
  /** 税込（円）＝入金予測に使う金額 */
  total: number
  pdf_url: string | null
}

/** 'YYYY/MM/DD' → 'YYYY-MM-DD'。空なら null */
function normalizeDate(v: string | undefined): string | null {
  if (!v) return null
  return v.replaceAll('/', '-').slice(0, 10)
}

/** '100000.0' → 100000 */
function toYen(v: string | undefined): number {
  const n = Number.parseFloat(v ?? '0')
  return Number.isFinite(n) ? Math.round(n) : 0
}

function isSelfBilling(partnerName: string): boolean {
  return SELF_PARTNER_PATTERNS.some((p) => partnerName.includes(p))
}

function normalize(raw: RawBilling): Billing {
  const status = raw.payment_status ?? ''
  return {
    id: raw.id,
    partner_id: raw.partner_id ?? null,
    partner_name: (raw.partner_name ?? '').trim(),
    title: (raw.title ?? '').trim(),
    billing_date: normalizeDate(raw.billing_date),
    due_date: normalizeDate(raw.due_date),
    sales_date: normalizeDate(raw.sales_date),
    payment_status: status,
    is_paid: PAID_STATUSES.has(status),
    subtotal: toYen(raw.subtotal_price),
    tax: toYen(raw.excise_price),
    total: toYen(raw.total_price),
    pdf_url: raw.pdf_url ?? null,
  }
}

/**
 * 指定期間の請求書を全ページ取得する。
 * includeExcluded=true にすると自社宛・除外指定分も含めて返す（棚卸し用）。
 *
 * 注意: MF側にも `q` パラメータがあるが「取引先名/件名の前方一致」でしか効かない
 * （'株式会社Dressmore'は当たるが'Dressmore'は0件）。誤って0件と誤認する事故を避けるため
 * サーバー側検索は使わず、期間で取得してから filterBillings() で部分一致させる方針。
 */
export async function fetchBillings(args: {
  from: string
  to: string
  rangeKey?: BillingRangeKey
  includeExcluded?: boolean
}): Promise<Billing[]> {
  const token = await getValidAccessToken()
  const rangeKey = args.rangeKey ?? 'due_date'

  const out: Billing[] = []
  let page = 1
  let totalPages = 1

  // MF側の上限は per_page=100。total_pages を見て全件まわす。
  do {
    const params = new URLSearchParams({
      from: args.from,
      to: args.to,
      range_key: rangeKey,
      page: String(page),
      per_page: '100',
    })
    const res = await fetch(`${MF_INVOICE_API_BASE}/billings.json?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`MF API GET /billings.json → ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as { data?: RawBilling[]; pagination?: { total_pages?: number } }
    out.push(...(json.data ?? []).map(normalize))
    totalPages = json.pagination?.total_pages ?? 1
    page += 1
  } while (page <= totalPages)

  if (args.includeExcluded) return out
  return out.filter((b) => !EXCLUDED_BILLING_IDS.has(b.id) && !isSelfBilling(b.partner_name))
}

/**
 * 取引先名・件名の部分一致で絞り込む（大文字小文字を無視）。
 * MFの `q` は前方一致なので、こちらで持つ。
 */
export function filterBillings(billings: Billing[], keyword: string | undefined): Billing[] {
  if (!keyword) return billings
  const needle = keyword.toLowerCase()
  return billings.filter(
    (b) => b.partner_name.toLowerCase().includes(needle) || b.title.toLowerCase().includes(needle)
  )
}

export type MonthlyForecastRow = {
  /** 入金予定月（YYYY-MM） */
  month: string
  count: number
  /** 入金予定額（税込・円） */
  amount: number
  /** うち支払期日を過ぎている分（円） */
  overdue_amount: number
}

/** 未入金の請求書を入金予定月（due_date）で束ねる */
export function buildMonthlyForecast(billings: Billing[], today: string): MonthlyForecastRow[] {
  const map = new Map<string, MonthlyForecastRow>()
  for (const b of billings) {
    if (b.is_paid) continue
    const month = b.due_date?.slice(0, 7) ?? '(期日なし)'
    const row = map.get(month) ?? { month, count: 0, amount: 0, overdue_amount: 0 }
    row.count += 1
    row.amount += b.total
    if (b.due_date && b.due_date < today) row.overdue_amount += b.total
    map.set(month, row)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/** 今日（JST）を YYYY-MM-DD で返す */
export function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** JSTの今日からnヶ月ずらした日付を YYYY-MM-DD で返す（負値で過去） */
export function shiftMonthsJST(months: number): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** 支払期日からの経過日数（マイナスなら未到来） */
export function overdueDays(dueDate: string | null, today: string): number | null {
  if (!dueDate) return null
  return Math.floor((Date.parse(today) - Date.parse(dueDate)) / 86_400_000)
}
