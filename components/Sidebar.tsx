'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BriefcaseBusiness, ClipboardList, Settings, Users, Menu, X, BookOpen, Tent, UserPlus, Zap, GanttChartSquare, FileText, List, MonitorPlay, ChevronDown, Contact, TrendingUp, Bell, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NewsBell from '@/components/NewsBell'

const NEWS_READ_KEY = 'kindler_news_read'

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

function NavLink({ href, label, icon: Icon, onClick, badge }: { href: string; label: string; icon: React.ElementType; onClick?: () => void; badge?: number }) {
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
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
          {badge}
        </span>
      )}
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
  const [unreadNews, setUnreadNews] = useState(0)
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    async function checkUnread() {
      const { data } = await supabase.from('news').select('id').eq('archived', false)
      if (!data) return
      try {
        const stored = localStorage.getItem(NEWS_READ_KEY)
        const readIds: string[] = stored ? JSON.parse(stored) : []
        const readSet = new Set(readIds)
        setUnreadNews(data.filter(n => !readSet.has(n.id)).length)
      } catch {
        setUnreadNews(data.length)
      }
    }
    checkUnread()
  }, [])

  return (
    <>
      {/* モバイル トップバー */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-navy rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
          <span className="font-bold text-slate-900 text-base">KINDLER</span>
        </div>
        <div className="flex items-center gap-0.5">
          <NewsBell />
          <button onClick={() => setOpen(true)} className="p-2 text-slate-500 hover:text-slate-900 transition-colors">
            <Menu size={22} />
          </button>
        </div>
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
              <NavLink href="/news" label="お知らせ" icon={Bell} onClick={() => setOpen(false)} badge={unreadNews} />
              <OrderFormNavItem onClick={() => setOpen(false)} />
            </nav>
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <LogOut size={14} />
                ログアウト
              </button>
            </div>
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
          <NavLink href="/news" label="お知らせ" icon={Bell} badge={unreadNews} />
          <OrderFormNavItem />
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      </aside>
    </>
  )
}
