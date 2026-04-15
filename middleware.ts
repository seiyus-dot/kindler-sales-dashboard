import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// 認証不要の公開パス
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/order-form',
  '/product-aicamp/apply',
]

// 公開 API（未認証でも POST 可）
const PUBLIC_API_PATHS = [
  '/api/order-requests',
  '/api/product-aicamp/apply',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開パスはそのまま通過
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 公開 API は POST のみ通過（GET/PATCH は認証必須）
  if (PUBLIC_API_PATHS.some(p => pathname.startsWith(p)) && request.method === 'POST') {
    return NextResponse.next()
  }

  // 静的ファイル・Next.js 内部パスはスキップ
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ① 未認証チェック
  if (!user) {
    // API ルートは 401 を返す
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ② ページアクセス権限チェック（member のみ）
  const role = request.cookies.get('user_role')?.value
  if (role === 'admin') {
    return res
  }

  // API ルートは role チェックをスキップ（フロントのページで制御）
  if (pathname.startsWith('/api/')) {
    return res
  }

  const allowedPagesCookie = request.cookies.get('user_allowed_pages')?.value
  const allowedPages: string[] = allowedPagesCookie
    ? JSON.parse(decodeURIComponent(allowedPagesCookie))
    : ['/aicamp']

  const isAllowed = allowedPages.some(p => pathname.startsWith(p))
  if (!isAllowed) {
    const redirectTo = allowedPages[0] ?? '/aicamp'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
