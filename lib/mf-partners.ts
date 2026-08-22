/**
 * マネーフォワード クラウド請求書 API v3 の「取引先の読み取り」（サーバー側専用）
 *
 * 自由明細の請求書を発行するとき、clients マスタを経由せず MF の取引先を直接選べるようにする。
 * （OOSHISHI株式会社のように MF には居るが clients マスタには無い取引先が実在するため）
 *
 * 注意: MFの検索パラメータ `q` は前方一致でしか効かない（lib/mf-billings.ts と同じ罠）。
 * 「0件」と誤認する事故を避けるため、全件取得してから部分一致で絞る。
 */
import { MF_INVOICE_API_BASE, getValidAccessToken } from './mf-auth'

export type MfPartner = {
  id: string
  name: string
  name_kana: string | null
  /** 請求書発行に必須。取引先の既定部署ID */
  department_id: string
}

type RawPartner = {
  id: string
  name?: string
  name_kana?: string
  departments?: { id: string }[]
}

/** 取引先を全ページ取得する（現状215件・per_page=100で3ページ程度） */
export async function fetchAllPartners(): Promise<MfPartner[]> {
  const token = await getValidAccessToken()
  const out: MfPartner[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await fetch(
      `${MF_INVOICE_API_BASE}/partners.json?page=${page}&per_page=100`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) {
      throw new Error(`MF API GET /partners.json → ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as { data?: RawPartner[]; pagination?: { total_pages?: number } }
    for (const p of json.data ?? []) {
      const departmentId = p.departments?.[0]?.id
      // 部署が無い取引先には請求書を発行できないので候補から外す
      if (!departmentId) continue
      out.push({
        id: p.id,
        name: (p.name ?? '').trim(),
        name_kana: p.name_kana?.trim() || null,
        department_id: departmentId,
      })
    }
    totalPages = json.pagination?.total_pages ?? 1
    page += 1
  } while (page <= totalPages)

  return out.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

/** 取引先名・カナの部分一致で絞り込む（大文字小文字を無視） */
export function filterPartners(partners: MfPartner[], keyword: string | undefined): MfPartner[] {
  if (!keyword?.trim()) return partners
  const needle = keyword.trim().toLowerCase()
  return partners.filter(
    (p) => p.name.toLowerCase().includes(needle) || (p.name_kana ?? '').toLowerCase().includes(needle)
  )
}
