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
  return user ?? null
}
