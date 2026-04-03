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
      <body className="bg-slate-50 min-h-screen">
        <div className="flex h-screen">
          <aside className="w-52 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-base">K</div>
                <div>
                  <div className="text-base font-bold text-slate-900">KINDLER</div>
                  <div className="text-sm text-slate-400">営業管理</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1">
              <NavItem href="/dashboard" label="ダッシュボード" icon={<LayoutDashboard size={16} />} />
              <NavItem href="/deals"     label="案件管理"       icon={<BriefcaseBusiness size={16} />} />
              <NavItem href="/weekly"    label="週次ログ"       icon={<ClipboardList size={16} />} />
              <NavItem href="/members"   label="メンバー"       icon={<Users size={16} />} />
              <NavItem href="/settings"  label="マスタ設定"     icon={<Settings size={16} />} />
            </nav>
          </aside>

          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
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
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-base text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors font-medium"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </Link>
  )
}
