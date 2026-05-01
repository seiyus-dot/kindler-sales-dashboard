'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BriefcaseBusiness, ClipboardList, Settings, Users, Menu, X, BookOpen, Tent, UserPlus, Zap, GanttChartSquare, FileText, List, MonitorPlay, ChevronDown, Contact, TrendingUp } from 'lucide-react'

const navItems = [
  { href: '/dashboard',      label: 'ダッシュボード',    icon: LayoutDashboard },
  { href: '/deals',          label: '法人案件',          icon: BriefcaseBusiness },
  { href: '/weekly',         label: '週次ログ',          icon: ClipboardList },
  { href: '/mrr',            label: 'MRR推移',           icon: TrendingUp },
  { href: '/members',        label: 'メンバー',          icon: Users },
  { href: '/settings',       label: 'マスタ設定',        icon: Settings },
  { href: '/knowledge',      label: '営業ナレッジ',      icon: BookOpen },
  { href: '/aicamp',         label: 'AI CAMP',           icon: Tent },
  { href: '/product-aicamp', label: 'Product AI CAMP',   icon: MonitorPlay },
  { href: '/customers',      label: '顧客管理',          icon: Contact },
  { href: '/invites',        label: '招待管理',          icon: UserPlus },
  { href: '/utage',          label: 'UTAGE',             icon: Zap },
  { href: '/advisor',        label: 'AI顧問管理',        icon: GanttChartSquare },
  { href: '/order-requests', label: '発注リスト',        icon: List },
]

const orderFormSubItems = [
  { href: '/order-form',           label: '法人' },
  { href: '/product-aicamp/apply', label: 'Product AI CAMP' },
]

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  const pathname = usePathname()
  const active = pathname.startsWith(href)
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-navy/10 text-navy font-semibold' : 'text-slate-500 hover:bg-navy/5 hover:text-navy'
      }`}
    >
      <Icon size={16} className={active ? 'text-navy' : 'text-slate-400'} />
      {label}
    </Link>
  )
}

function OrderFormNavItem({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname()
  const active = pathname.startsWith('/order-form') || pathname.startsWith('/product-aicamp/apply')
  const [open, setOpen] = useState(active)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
          active ? 'bg-navy/10 text-navy font-semibold' : 'text-slate-500 hover:bg-navy/5 hover:text-navy'
        }`}
      >
        <FileText size={16} className={active ? 'text-navy' : 'text-slate-400'} />
        <span className="flex-1 text-left">発注フォーム</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-7 mt-0.5 space-y-0.5">
          {orderFormSubItems.map(item => {
            const subActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClick}
                className={`block px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  subActive ? 'bg-navy/10 text-navy font-semibold' : 'text-slate-500 hover:bg-navy/5 hover:text-navy'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* モバイル トップバー */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-navy rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
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
                <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
                <div>
                  <div className="text-sm font-bold text-slate-900">KINDLER</div>
                  <div className="text-xs text-slate-400">営業管理</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <NavLink key={item.href} {...item} onClick={() => setOpen(false)} />
              ))}
              <OrderFormNavItem onClick={() => setOpen(false)} />
            </nav>
          </aside>
        </div>
      )}

      {/* デスクトップ サイドバー */}
      <aside className="hidden lg:flex w-52 bg-white border-r border-slate-200 flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center text-white font-black text-base">K</div>
            <div>
              <div className="text-base font-bold text-slate-900">KINDLER</div>
              <div className="text-sm text-slate-400">営業管理</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
          <OrderFormNavItem />
        </nav>
      </aside>
    </>
  )
}
