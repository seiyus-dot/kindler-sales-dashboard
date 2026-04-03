'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BriefcaseBusiness, ClipboardList, Settings, Users, Menu, X } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/deals',     label: '案件管理',       icon: BriefcaseBusiness },
  { href: '/weekly',    label: '週次ログ',       icon: ClipboardList },
  { href: '/members',   label: 'メンバー',       icon: Users },
  { href: '/settings',  label: 'マスタ設定',     icon: Settings },
]

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
        active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon size={18} className={active ? 'text-indigo-600' : 'text-slate-400'} />
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* モバイル トップバー */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
          <span className="font-bold text-slate-900 text-base">KINDLER</span>
        </div>
        <button onClick={() => setOpen(true)} className="p-2 text-slate-500 hover:text-slate-900 transition-colors">
          <Menu size={22} />
        </button>
      </div>

      {/* モバイル ドロワー */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
                <div>
                  <div className="text-sm font-bold text-slate-900">KINDLER</div>
                  <div className="text-xs text-slate-400">営業管理</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1">
              {navItems.map(item => (
                <NavLink key={item.href} {...item} onClick={() => setOpen(false)} />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* デスクトップ サイドバー */}
      <aside className="hidden lg:flex w-52 bg-white border-r border-slate-200 flex-col flex-shrink-0">
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
          {navItems.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>
    </>
  )
}
