import { NextRequest, NextResponse } from 'next/server'
import { createDealFolder } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { companyName } = await req.json()
    if (!companyName) return NextResponse.json({ error: '企業名が必要です' }, { status: 400 })
    const folderId = await createDealFolder(companyName)
    return NextResponse.json({ folderId })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
