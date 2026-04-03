import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { LayoutDashboard, BriefcaseBusiness, ClipboardList, Settings, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'KINDLER 営業管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <div className="flex h-screen">
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center text-white font-black text-base">K</div>
                <div>
                  <div className="text-base font-bold">KINDLER</div>
                  <div className="text-sm text-gray-400">営業管理</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              <NavItem href="/dashboard" label="ダッシュボード" icon={<LayoutDashboard size={16} />} />
              <NavItem href="/deals"     label="案件管理"       icon={<BriefcaseBusiness size={16} />} />
              <NavItem href="/weekly"    label="週次ログ"       icon={<ClipboardList size={16} />} />
              <NavItem href="/members"   label="メンバー"       icon={<Users size={16} />} />
              <NavItem href="/settings"  label="マスタ設定"     icon={<Settings size={16} />} />
            </nav>
          </aside>

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

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-base text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  )
}
