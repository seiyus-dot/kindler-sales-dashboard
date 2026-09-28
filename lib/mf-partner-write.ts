/**
 * マネーフォワード クラウド請求書 API v3 の「取引先の書き込み」（サーバー側専用）
 *
 * lib/mf-partners.ts（検索・読み取り専用）とは別系統。契約（Supabase clients）に
 * 紐づかない、AIから直接指定された取引先マスタの新規登録・更新に使う。
 */
import { MF_INVOICE_API_BASE, getValidAccessToken } from './mf-auth'

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

export type PartnerDepartmentInput = {
  name?: string
  zip?: string
  address1?: string
  address2?: string
  tel?: string
  email?: string
  person_name?: string
  person_title?: string
}

type MFPartnerDepartment = { id: string }
type MFPartner = { id: string; name?: string; departments?: MFPartnerDepartment[] }

/** 取引先を新規登録する。部署情報（住所・担当者）を渡すとデフォルト部署にそのまま反映する */
export async function createPartnerFreeform(args: {
  name: string
  nameKana?: string
  department?: PartnerDepartmentInput
}): Promise<{ id: string; departmentId: string }> {
  const partner = await mfFetch<MFPartner>('/partners.json', {
    method: 'POST',
    body: JSON.stringify({ name: args.name, name_kana: args.nameKana || undefined, name_suffix: '御中' }),
  })
  const departmentId = partner.departments?.[0]?.id
  if (!partner.id || !departmentId) {
    throw new Error('MF取引先作成のレスポンスにIDまたはdepartment IDが含まれていません')
  }
  if (args.department) {
    await mfFetch(`/partners/${partner.id}/departments/${departmentId}.json`, {
      method: 'PUT',
      body: JSON.stringify(args.department),
    })
  }
  return { id: partner.id, departmentId }
}

/** 取引先名・カナを更新する */
export async function updatePartnerName(
  partnerId: string,
  args: { name?: string; nameKana?: string },
): Promise<void> {
  await mfFetch(`/partners/${partnerId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ name: args.name, name_kana: args.nameKana }),
  })
}

/** 既存部署の住所・担当者情報を更新する */
export async function updatePartnerDepartmentFreeform(
  partnerId: string,
  departmentId: string,
  args: PartnerDepartmentInput,
): Promise<void> {
  await mfFetch(`/partners/${partnerId}/departments/${departmentId}.json`, {
    method: 'PUT',
    body: JSON.stringify(args),
  })
}

/** 同一取引先に部署（請求先違い）を追加する */
export async function addPartnerDepartment(
  partnerId: string,
  args: PartnerDepartmentInput,
): Promise<{ id: string }> {
  return await mfFetch<{ id: string }>(`/partners/${partnerId}/departments.json`, {
    method: 'POST',
    body: JSON.stringify(args),
  })
}
