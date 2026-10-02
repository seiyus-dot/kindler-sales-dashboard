import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

/**
 * API ルート用の認証チェック。
 * ユーザーが認証済みなら user を返し、未認証なら null を返す。
 *
 * 使用例:
 *   const user = await getAuthUser(request)
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 */
export async function getAuthUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // API ルートではクッキーの書き込み不要
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 代理店アカウントは社内向けAPIを使えない（代理店向けは /api/agency-report のみ）
  const { data: isAgency, error } = await supabase.rpc('is_agency_user')
  if (!error && isAgency) return null

  return user
}
