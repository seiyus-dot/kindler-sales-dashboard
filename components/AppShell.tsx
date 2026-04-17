'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const isPublicForm = pathname.startsWith('/order-form') || pathname.startsWith('/product-aicamp/apply')

  if (isLoginPage || isPublicForm) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 pt-16 lg:p-6 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  )
}
