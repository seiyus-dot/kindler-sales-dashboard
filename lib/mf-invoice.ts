/**
 * マネーフォワード クラウド請求書 API v3 ラッパー（サーバー側専用）
 *
 * API base: https://invoice.moneyforward.com/api/v3
 * 認証: Bearer <access_token>
 *
 * Phase 2-B：取引先（partner）・見積書（quote）・請求書（billing）の作成のみ実装
 */
import { MF_INVOICE_API_BASE, getValidAccessToken } from './mf-auth'
import type { Client, Contract, ContractItem } from './supabase'

// ---------------------------------------------
// 低レベル: 認証付き fetch
// ---------------------------------------------
async function mfFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getValidAccessToken()
  const res = await fetch(`${MF_INVOICE_API_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
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

// ---------------------------------------------
// 取引先（Partner）
// MF v3：リクエストボディは {partner: {...}} でラップ。
// レスポンスには departments 配列が含まれ、見積/請求書には partner の department_id が必要。
// ---------------------------------------------
type MFPartnerDepartment = { id: string }
type MFPartner = {
  id: string
  name?: string
  departments?: MFPartnerDepartment[]
}

function partnerPayload(client: Client) {
  return {
    name: client.company_name,
    name_kana: client.company_name_kana ?? undefined,
    name_suffix: '御中',
  }
}

// 住所・担当者情報は partner 本体ではなく部署（department）側のフィールド。
// POST /partners.json はデフォルト部署を1件自動生成するだけで、
// zip/address1/tel/email/person_name等を渡してもここでは反映されない（要注意）。
function departmentPayload(client: Client) {
  return {
    zip: client.postal_code ?? undefined,
    address1: client.address ?? undefined,
    tel: client.contact_phone ?? undefined,
    email: client.contact_email ?? undefined,
    person_name: client.contact_name ?? undefined,
    person_title: client.contact_title ?? undefined,
  }
}

// 部署（department）の住所・担当者情報を更新する。
// 新規作成直後の反映にも、既存取引先の情報を後から同期する場合にも使う。
export async function updatePartnerDepartment(
  partnerId: string,
  departmentId: string,
  client: Client,
): Promise<void> {
  await mfFetch(`/partners/${partnerId}/departments/${departmentId}.json`, {
    method: 'PUT',
    body: JSON.stringify(departmentPayload(client)),
  })
}

export async function createPartner(client: Client): Promise<{ id: string; departmentId: string }> {
  // v3 はフラット構造（ラップ不要）
  const partner = await mfFetch<MFPartner>('/partners.json', {
    method: 'POST',
    body: JSON.stringify(partnerPayload(client)),
  })
  const departmentId = partner.departments?.[0]?.id
  if (!partner.id || !departmentId) {
    throw new Error('MF取引先作成のレスポンスにIDまたはdepartment IDが含まれていません')
  }
  // 作成直後は部署情報が空なので、住所・担当者情報を追って反映する
  await updatePartnerDepartment(partner.id, departmentId, client)
  return { id: partner.id, departmentId }
}

// 既存パートナーから department_id を取得（取引先IDだけ知ってる場合のフォールバック）
export async function fetchPartnerDepartmentId(partnerId: string): Promise<string> {
  const partner = await mfFetch<MFPartner>(`/partners/${partnerId}.json`, { method: 'GET' })
  const departmentId = partner.departments?.[0]?.id
  if (!departmentId) throw new Error(`partner ${partnerId} に部署が登録されていません`)
  return departmentId
}

// ---------------------------------------------
// 見積書（Quote）
// ---------------------------------------------
type MFQuoteResponse = {
  id: string
  pdf_url?: string
  attachment?: { url?: string }
}

type LineItem = {
  name: string
  quantity: number
  unit_price: number
  unit?: string
}

function itemsFromContract(items: ContractItem[], contract: Contract): LineItem[] {
  return items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      unit: contract.contract_type === 'training' ? '名' : 'ヶ月',
    }))
}

function todayJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function addDaysJST(days: number): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + days * 86400000)
  return jst.toISOString().slice(0, 10)
}

export async function createQuote(args: {
  partnerDepartmentId: string
  client: Client
  contract: Contract
  items: ContractItem[]
}): Promise<MFQuoteResponse> {
  const lines = itemsFromContract(args.items, args.contract)
  const body = {
    department_id: args.partnerDepartmentId,
    title: args.contract.contract_type === 'training' ? 'AI研修 御見積書' : 'AI顧問 御見積書',
    quote_date: todayJST(),
    expired_date: addDaysJST(30),
    items: lines.map(l => ({
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      price: l.unit_price,
      excise: 'ten_percent',
    })),
  }
  return await mfFetch<MFQuoteResponse>('/quotes.json', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------
// 請求書（Billing）
// ---------------------------------------------
type MFBillingResponse = {
  id: string
  pdf_url?: string
  attachment?: { url?: string }
}

export async function createBilling(args: {
  partnerDepartmentId: string
  client: Client
  contract: Contract
  items: ContractItem[]
}): Promise<MFBillingResponse> {
  const lines = itemsFromContract(args.items, args.contract)
  const body = {
    department_id: args.partnerDepartmentId,
    title: args.contract.contract_type === 'training' ? 'AI研修 請求書' : 'AI顧問 請求書',
    billing_date: todayJST(),
    due_date: addDaysJST(30),
    sales_date: todayJST(),
    items: lines.map(l => ({
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      price: l.unit_price,
      excise: 'ten_percent',
    })),
    config: { consumption_tax_display_type: 'internal' },
  }
  // 注意: 請求書の新規作成は /billings.json ではなく /invoice_template_billings.json（v3実仕様）。
  // /billings.json はGET(一覧・詳細)専用で、POSTすると404 not_foundが返る。
  return await mfFetch<MFBillingResponse>('/invoice_template_billings.json', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------
// 自由明細の請求書（契約に紐づかない実費・スポット請求用）
//
// createBilling は contracts 起点で単位が「名」「ヶ月」に固定されるため、
// 交通費・出張対応費のような実費請求には使えない。品目・単位・単価を
// 呼び出し側から自由に渡せる経路をここに用意する。
// ---------------------------------------------
export type FreeBillingItem = {
  name: string
  quantity: number
  unit: string
  /** 税抜単価（円） */
  unitPrice: number
  /** 消費税率（%）。省略時10。対応外の値は10%として扱う */
  taxRate?: number
}

/** 税率(%) → MF v3 の excise コード。未指定・非対応値は標準税率にフォールバック */
function exciseForTaxRate(taxRate: number | undefined): string {
  switch (taxRate) {
    case 8:
      return 'eight_percent_as_reduced_tax_rate'
    case 0:
      return 'tax_exempt'
    case 10:
    case undefined:
      return 'ten_percent'
    default:
      return 'ten_percent'
  }
}

export async function createFreeBilling(args: {
  partnerDepartmentId: string
  title: string
  billingDate: string
  dueDate: string
  salesDate?: string
  memo?: string
  items: FreeBillingItem[]
}): Promise<MFBillingResponse> {
  const body = {
    department_id: args.partnerDepartmentId,
    title: args.title,
    billing_date: args.billingDate,
    due_date: args.dueDate,
    sales_date: args.salesDate || args.billingDate,
    memo: args.memo || undefined,
    items: args.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      price: it.unitPrice,
      excise: exciseForTaxRate(it.taxRate),
    })),
    config: { consumption_tax_display_type: 'internal' },
  }
  // createBilling と同じく、新規作成は /invoice_template_billings.json が正しい
  return await mfFetch<MFBillingResponse>('/invoice_template_billings.json', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// 共通：レスポンスから PDF URL を取り出す
export function extractPdfUrl(res: { pdf_url?: string; attachment?: { url?: string } }): string | null {
  return res.pdf_url ?? res.attachment?.url ?? null
}
