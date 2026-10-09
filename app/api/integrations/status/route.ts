/** 連携ページ用：ログイン中の本人の外部サービス連携の状態（鍵そのものは返さない） */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-check'
import { googleLinkStatus, isGoogleLoginConfigured } from '@/lib/gmail-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  const email = user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({
      email,
      google: { configured: isGoogleLoginConfigured(), ...(await googleLinkStatus(email)) },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
