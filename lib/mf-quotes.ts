/**
 * マネーフォワード クラウド請求書 API v3 の「見積書」ラッパー（サーバー側専用）
 *
 * lib/mf-invoice.ts の createQuote()（契約(Supabase contracts)起点、単位固定）とは別系統。
 * こちらは請求書のcreateFreeBilling/updateBillingRaw等と同じく、AIから自由明細で
 * 見積書の下書きを検索・作成・更新・削除できるようにする。送付（posting）・受注ステータス
 * 更新など「実際に相手に届く／実ビジネス上の意思決定を記録する」操作はここに含めていない。
 */
import { MF_INVOICE_API_BASE, getValidAccessToken } from './mf-auth'
import { exciseForTaxRate, type FreeBillingItem } from './mf-invoice'

async function mfFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken()
  const res = await fetch(`${MF_INVOICE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`MF API ${init.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}

export const QUOTE_RANGE_KEYS = ['quote_date', 'expired_date', 'created_at', 'updated_at'] as const
export type QuoteRangeKey = (typeof QUOTE_RANGE_KEYS)[number]

type RawQuoteItem = {
  id?: string
  name?: string
  quantity?: number | string
  price?: number | string
}

type RawQuote = {
  id: string
  partner_id?: string
  partner_name?: string
  title?: string
  memo?: string
  note?: string
  quote_number?: string
  quote_date?: string
  expired_date?: string
  order_status?: string
  transmit_status?: string
  posting_status?: string
  subtotal_price?: string
  excise_price?: string
  total_price?: string
  pdf_url?: string
  items?: RawQuoteItem[]
}

export type QuoteItem = {
  id: string | null
  name: string
  quantity: number
  unit_price: number
}

export type Quote = {
  id: string
  partner_id: string | null
  partner_name: string
  title: string
  memo: string | null
  note: string | null
  quote_number: string | null
  quote_date: string | null
  expired_date: string | null
  order_status: string | null
  transmit_status: string | null
  posting_status: string | null
  subtotal: number
  tax: number
  total: number
  pdf_url: string | null
}

export type QuoteDetail = Quote & { items: QuoteItem[] }

function normalizeDate(v: string | undefined): string | null {
  if (!v) return null
  return v.replaceAll('/', '-').slice(0, 10)
}

function toYen(v: string | number | undefined): number {
  const n = Number.parseFloat(String(v ?? '0'))
  return Number.isFinite(n) ? Math.round(n) : 0
}

function normalize(raw: RawQuote): Quote {
  return {
    id: raw.id,
    partner_id: raw.partner_id ?? null,
    partner_name: (raw.partner_name ?? '').trim(),
    title: (raw.title ?? '').trim(),
    memo: raw.memo?.trim() || null,
    note: raw.note?.trim() || null,
    quote_number: raw.quote_number?.trim() || null,
    quote_date: normalizeDate(raw.quote_date),
    expired_date: normalizeDate(raw.expired_date),
    order_status: raw.order_status ?? null,
    transmit_status: raw.transmit_status ?? null,
    posting_status: raw.posting_status ?? null,
    subtotal: toYen(raw.subtotal_price),
    tax: toYen(raw.excise_price),
    total: toYen(raw.total_price),
    pdf_url: raw.pdf_url ?? null,
  }
}

function normalizeItems(raw: RawQuoteItem[] | undefined): QuoteItem[] {
  return (raw ?? []).map((it) => ({
    id: it.id ?? null,
    name: (it.name ?? '').trim(),
    quantity: Number(it.quantity ?? 0),
    unit_price: toYen(it.price),
  }))
}

/** 指定期間の見積書を全ページ取得する */
export async function fetchQuotes(args: {
  from: string
  to: string
  rangeKey?: QuoteRangeKey
}): Promise<Quote[]> {
  const out: Quote[] = []
  let page = 1
  let totalPages = 1
  do {
    const params = new URLSearchParams({
      from: args.from,
      to: args.to,
      range_key: args.rangeKey ?? 'quote_date',
      page: String(page),
      per_page: '100',
    })
    const json = await mfFetch<{ data?: RawQuote[]; pagination?: { total_pages?: number } }>(
      `/quotes.json?${params.toString()}`
    )
    out.push(...(json.data ?? []).map(normalize))
    totalPages = json.pagination?.total_pages ?? 1
    page += 1
  } while (page <= totalPages)
  return out
}

/** 取引先名・件名の部分一致で絞り込む（MFのqは前方一致のためこちら側で持つ） */
export function filterQuotes(quotes: Quote[], keyword: string | undefined): Quote[] {
  if (!keyword) return quotes
  const needle = keyword.toLowerCase()
  return quotes.filter(
    (q) => q.partner_name.toLowerCase().includes(needle) || q.title.toLowerCase().includes(needle)
  )
}

async function fetchRawQuote(id: string): Promise<Record<string, unknown> | null> {
  const token = await getValidAccessToken()
  const res = await fetch(`${MF_INVOICE_API_BASE}/quotes/${id}.json`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`MF API GET /quotes/${id}.json → ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data?: Record<string, unknown> } | Record<string, unknown>
  return ('data' in json && json.data ? json.data : json) as Record<string, unknown>
}

export async function fetchQuoteById(id: string): Promise<QuoteDetail | null> {
  const raw = (await fetchRawQuote(id)) as RawQuote | null
  if (!raw) return null
  return { ...normalize(raw), items: normalizeItems(raw.items) }
}

export type QuoteWriteResponse = { id: string; pdf_url?: string; attachment?: { url?: string } }

export async function createQuoteDraft(args: {
  partnerDepartmentId: string
  title: string
  quoteDate: string
  expiredDate: string
  memo?: string
  items: FreeBillingItem[]
}): Promise<QuoteWriteResponse> {
  const body = {
    department_id: args.partnerDepartmentId,
    title: args.title,
    quote_date: args.quoteDate,
    expired_date: args.expiredDate,
    memo: args.memo || undefined,
    items: args.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      price: it.unitPrice,
      excise: exciseForTaxRate(it.taxRate),
    })),
  }
  return await mfFetch<QuoteWriteResponse>('/quotes.json', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateQuoteRaw(id: string, body: Record<string, unknown>): Promise<QuoteWriteResponse> {
  return await mfFetch<QuoteWriteResponse>(`/quotes/${id}.json`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function deleteQuoteDraft(id: string): Promise<void> {
  await mfFetch<void>(`/quotes/${id}.json`, { method: 'DELETE' })
}

/** 見積書を請求書に変換する（承諾後の請求書起票をワンステップで行う） */
export async function convertQuoteToBilling(id: string): Promise<QuoteWriteResponse> {
  return await mfFetch<QuoteWriteResponse>(`/quotes/${id}/convert_to_billing.json`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export { fetchRawQuote }
