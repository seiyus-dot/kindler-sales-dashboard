import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// デモモード: 認証不要、全ページ公開
export async function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
