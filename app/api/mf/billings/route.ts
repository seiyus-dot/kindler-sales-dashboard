/**
 * 自由明細の請求書をMFに作成する。
 *
 * 実際に先方へ渡る書類を作る操作なので、誤発行を防ぐガードを入れてある:
 * - 認証必須
 * - 明細が空、数量0以下、単価が負、件名なしは拒否
 * - 取引先の部署IDが無ければ拒否
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-check'
import { createFreeBilling, extractPdfUrl, type FreeBillingItem } from '@/lib/mf-invoice'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  if (!await getAuthUser(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { partnerDepartmentId, title, billingDate, dueDate, salesDate, memo } = body

    if (!partnerDepartmentId) throw new Error('取引先が選択されていません')
    if (!title?.trim()) throw new Error('件名を入力してください')
    if (!DATE.test(billingDate ?? '')) throw new Error('請求日の形式が不正です')
    if (!DATE.test(dueDate ?? '')) throw new Error('支払期日の形式が不正です')
    if (salesDate && !DATE.test(salesDate)) throw new Error('売上計上日の形式が不正です')

    const rawItems = Array.isArray(body.items) ? body.items : []
    const items: FreeBillingItem[] = rawItems.map((it: Record<string, unknown>, i: number) => {
      const name = String(it.name ?? '').trim()
      const quantity = Number(it.quantity)
      const unitPrice = Number(it.unitPrice)
      if (!name) throw new Error(`${i + 1}行目: 品目名を入力してください`)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${i + 1}行目: 数量は1以上で入力してください`)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`${i + 1}行目: 単価が不正です`)
      return { name, quantity, unit: String(it.unit ?? '').trim() || '式', unitPrice }
    })
    if (items.length === 0) throw new Error('明細が1行もありません')

    const res = await createFreeBilling({
      partnerDepartmentId,
      title: title.trim(),
      billingDate,
      dueDate,
      salesDate,
      memo,
      items,
    })

    return NextResponse.json({ ok: true, invoiceId: res.id, pdfUrl: extractPdfUrl(res) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    console.error('[mf/billings] failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
