import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // APIルートは全てスキップ
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isAuthCallback = pathname.startsWith('/auth/callback')
  const isPreview = pathname.startsWith('/preview')
  const isPublicForm = pathname.startsWith('/order-form') || pathname.startsWith('/product-aicamp/apply')

  // 未ログイン → ログインページへ
  if (!user && !isLoginPage && !isAuthCallback && !isPreview && !isPublicForm) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ログイン済みでログインページ → トップへ
  if (user && isLoginPage) {
    const role = request.cookies.get('user_role')?.value ?? 'member'
    const redirectTo = role === 'admin' ? '/dashboard' : '/aicamp'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // ページ権限チェック（memberのみ）
  if (user && !isAuthCallback) {
    const role = request.cookies.get('user_role')?.value ?? 'member'

    if (role === 'member') {
      const rawPages = request.cookies.get('user_allowed_pages')?.value
      const allowedPages: string[] = rawPages ? JSON.parse(rawPages) : ['/aicamp']

      const isAllowed = allowedPages.some((p) => pathname.startsWith(p))
      if (!isAllowed) {
        // 許可された最初のページへリダイレクト
        return NextResponse.redirect(new URL(allowedPages[0] ?? '/aicamp', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
