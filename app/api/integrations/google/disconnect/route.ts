/** 連携ページ用：ログイン中の本人のGoogle連携を解除する（本人の分だけ） */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-check'
import { unlinkGoogle } from '@/lib/gmail-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  const email = user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await unlinkGoogle(email)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
