import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'KINDLER 営業管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
                <div>
                  <div className="text-sm font-bold">KINDLER</div>
                  <div className="text-xs text-gray-400">営業管理</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              <NavItem href="/dashboard" label="ダッシュボード" />
              <NavItem href="/deals" label="案件管理" />
              <NavItem href="/weekly" label="週次ログ" />
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
    >
      {label}
    </Link>
  )
}
