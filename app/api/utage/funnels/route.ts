import { NextRequest, NextResponse } from 'next/server'
import { getFunnels } from '@/lib/utage'

export async function GET(req: NextRequest) {
  try {
    const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
    const data = await getFunnels(page)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
