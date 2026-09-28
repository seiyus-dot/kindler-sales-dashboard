/**
 * マネーフォワード クラウド請求書 API v3 の「品目マスタ」（サーバー側専用）
 *
 * 請求書・見積書の明細に毎回フリーテキストで打ち込む代わりに、よく使う品目
 * （例：「AI顧問月額」）を登録・検索できるようにする。lib/mf-invoice.ts の
 * FreeBillingItemとは別物：あちらは請求書1件ごとの明細行、こちらは使い回す
 * テンプレート（カタログ）。
 */
import { MF_INVOICE_API_BASE, getValidAccessToken } from './mf-auth'
import { exciseForTaxRate } from './mf-invoice'

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

type RawItem = {
  id: string
  name?: string
  code?: string
  detail?: string
  unit?: string
  price?: string | number
  excise?: string
}

export type MfItem = {
  id: string
  name: string
  code: string
  detail: string | null
  unit: string | null
  /** 税抜単価（円） */
  price: number
  excise: string | null
}

function normalize(raw: RawItem): MfItem {
  return {
    id: raw.id,
    name: (raw.name ?? '').trim(),
    code: raw.code ?? '',
    detail: raw.detail?.trim() || null,
    unit: raw.unit?.trim() || null,
    price: Math.round(Number.parseFloat(String(raw.price ?? '0'))) || 0,
    excise: raw.excise ?? null,
  }
}

/** 品目マスタを全件取得する */
export async function fetchAllItems(): Promise<MfItem[]> {
  const out: MfItem[] = []
  let page = 1
  let totalPages = 1
  do {
    const json = await mfFetch<{ data?: RawItem[]; pagination?: { total_pages?: number } }>(
      `/items.json?page=${page}&per_page=100`
    )
    out.push(...(json.data ?? []).map(normalize))
    totalPages = json.pagination?.total_pages ?? 1
    page += 1
  } while (page <= totalPages)
  return out
}

/** 品目名の部分一致で絞り込む（大文字小文字を無視） */
export function filterItems(items: MfItem[], keyword: string | undefined): MfItem[] {
  if (!keyword?.trim()) return items
  const needle = keyword.trim().toLowerCase()
  return items.filter((i) => i.name.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle))
}

export async function createItem(args: {
  name: string
  code: string
  detail?: string
  unit?: string
  price?: number
  taxRate?: number
}): Promise<MfItem> {
  const raw = await mfFetch<RawItem>('/items.json', {
    method: 'POST',
    body: JSON.stringify({
      name: args.name,
      code: args.code,
      detail: args.detail,
      unit: args.unit,
      price: args.price,
      excise: exciseForTaxRate(args.taxRate),
    }),
  })
  return normalize(raw)
}

export async function updateItem(
  id: string,
  args: { name?: string; code?: string; detail?: string; unit?: string; price?: number; taxRate?: number }
): Promise<MfItem> {
  const raw = await mfFetch<RawItem>(`/items/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      name: args.name,
      code: args.code,
      detail: args.detail,
      unit: args.unit,
      price: args.price,
      excise: args.taxRate !== undefined ? exciseForTaxRate(args.taxRate) : undefined,
    }),
  })
  return normalize(raw)
}
