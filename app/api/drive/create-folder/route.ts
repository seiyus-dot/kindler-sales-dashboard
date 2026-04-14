import { NextRequest, NextResponse } from 'next/server'
import { createDealFolder } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ test: 'POST reached' })
}
