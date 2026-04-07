import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        const { data: allowed } = await supabase
          .from('allowed_emails')
          .select('email, role, allowed_pages')
          .eq('email', user.email)
          .single()

        if (!allowed) {
          await supabase.auth.signOut()
          return NextResponse.redirect(new URL('/login?error=unauthorized', origin))
        }

        const role = allowed.role ?? 'member'
        const allowedPages: string[] = allowed.allowed_pages ?? ['/aicamp']
        const redirectTo = role === 'admin' ? '/dashboard' : (allowedPages[0] ?? '/aicamp')

        const res = NextResponse.redirect(new URL(redirectTo, origin))
        const cookieOpts = {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        }
        res.cookies.set('user_role', role, cookieOpts)
        res.cookies.set('user_allowed_pages', JSON.stringify(allowedPages), cookieOpts)
        return res
      }
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
}
