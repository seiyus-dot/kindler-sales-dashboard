/** MF取引先の検索（自由明細の請求書発行で取引先を選ぶために使う） */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-check'
import { fetchAllPartners, filterPartners } from '@/lib/mf-partners'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!await getAuthUser(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const q = req.nextUrl.searchParams.get('q') ?? undefined
    const partners = await fetchAllPartners()
    return NextResponse.json({ ok: true, partners: filterPartners(partners, q) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    console.error('[mf/partners] failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
