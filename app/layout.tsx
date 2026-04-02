import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'KINDLER 営業管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-[#fcfcfd] text-[#1a1a1a] min-h-screen font-sans selection:bg-blue-100">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-[#eceef0] flex flex-col z-20">
            <div className="p-6 border-b border-[#eceef0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0055ff] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/10 uppercase">K</div>
                <div>
                  <div className="text-sm font-bold tracking-tight text-[#1a1a1a]">KINDLER</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#8c8c8c] font-semibold">Sales Platform</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-[#8c8c8c] font-bold">Main</div>
              <NavItem href="/dashboard" label="ダッシュボード" />
              <NavItem href="/deals" label="案件管理" />
              <NavItem href="/weekly" label="週次ログ" />
              
              <div className="px-3 pt-6 mb-2 text-[10px] uppercase tracking-widest text-[#8c8c8c] font-bold">Settings</div>
              <NavItem href="/settings" label="設定" />
            </nav>
            <div className="p-4 border-t border-[#eceef0] bg-[#f9fafb]">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-[#e3e5e8] border border-[#d2d5d9]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate text-[#1a1a1a]">User Admin</div>
                  <div className="text-[10px] text-[#8c8c8c] truncate">admin@kindler.com</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Area */}
          <main className="flex-1 flex flex-col relative overflow-hidden">
            <header className="h-16 border-b border-[#eceef0] flex items-center justify-between px-8 bg-white/80 backdrop-blur-md z-10">
              <div className="text-sm font-medium text-[#8c8c8c]">Overview / <span className="text-[#1a1a1a]">Sales Dashboard</span></div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <button className="text-[#8c8c8c] hover:text-[#1a1a1a] transition-colors">Notifications</button>
                <div className="h-4 w-px bg-[#eceef0]" />
                <button className="bg-[#1a1a1a] text-white px-5 py-2 rounded-full hover:bg-[#333] transition-colors shadow-sm">Export Report</button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 max-w-7xl mx-auto w-full animate-in">
                {children}
              </div>
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
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#5f5f5f] hover:bg-[#f3f4f6] hover:text-[#1a1a1a] transition-all group"
    >
      {label}
    </Link>
  )
}

