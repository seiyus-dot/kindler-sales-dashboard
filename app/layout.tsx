import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'KINDLER 営業管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className="bg-[#030303] text-[#f5f5f7] min-h-screen font-sans selection:bg-blue-500/30">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 glass-sidebar flex flex-col z-20">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">K</div>
                <div>
                  <div className="text-sm font-bold tracking-tight">KINDLER</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Sales Platform</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-white/30 font-bold">Main</div>
              <NavItem href="/dashboard" label="ダッシュボード" icon="📊" />
              <NavItem href="/deals" label="案件管理" icon="💼" />
              <NavItem href="/weekly" label="週次ログ" icon="📅" />
              
              <div className="px-3 pt-6 mb-2 text-[10px] uppercase tracking-widest text-white/30 font-bold">Settings</div>
              <NavItem href="/settings" label="設定" icon="⚙️" />
            </nav>
            <div className="p-4 border-t border-white/5 bg-white/5">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 border border-white/10" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">User Admin</div>
                  <div className="text-[10px] text-white/40 truncate">admin@kindler.com</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Area */}
          <main className="flex-1 flex flex-col relative overflow-hidden">
            <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md z-10">
              <div className="text-sm font-medium text-white/60">Overview / <span className="text-white">Sales Dashboard</span></div>
              <div className="flex items-center gap-4">
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white/60">🔔</button>
                <div className="h-4 w-px bg-white/10" />
                <button className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-white/90 transition-colors">Export Report</button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
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

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-all group"
    >
      <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{icon}</span>
      {label}
    </Link>
  )
}
