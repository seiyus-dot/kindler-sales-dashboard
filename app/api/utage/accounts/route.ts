import { NextRequest, NextResponse } from 'next/server'
import { getAccounts, getScenarios } from '@/lib/utage'

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('accountId')

    if (accountId) {
      const data = await getScenarios(accountId)
      return NextResponse.json(data)
    }

    const data = await getAccounts()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
