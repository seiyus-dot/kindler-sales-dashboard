'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BriefcaseBusiness, ClipboardList, Settings, Users, Menu, X, BookOpen, Tent, UserPlus, Zap, GanttChartSquare, FileText, FileSignature, List, MonitorPlay, ChevronDown, Contact, TrendingUp, Bell, LogOut, CalendarCheck, Receipt, BarChart3, ScrollText, Link2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NewsBell from '@/components/NewsBell'

const NEWS_READ_KEY = 'kindler_news_read'

const GROUPS_OPEN_KEY = 'kindler_sidebar_groups'

type NavItem = { href: string; label: string; icon: React.ElementType }

// ダッシュボードはトグルせず常に一番上に出す
const dashboardItem: NavItem = { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard }

// ページを足したら、該当するグループの items に追加する
const navGroups: { key: string; label: string; items: NavItem[]; withOrderForm?: boolean }[] = [
  {
    key: 'sales',
    label: '営業',
    items: [
      { href: '/deals',     label: '法人案件',     icon: BriefcaseBusiness },
      { href: '/meetings',  label: 'MTG記録',      icon: CalendarCheck },
      { href: '/weekly',    label: '週次ログ',     icon: ClipboardList },
      { href: '/mrr',       label: 'MRR推移',      icon: TrendingUp },
      { href: '/members',   label: 'メンバー',     icon: Users },
      { href: '/customers', label: '顧客管理',     icon: Contact },
      { href: '/knowledge', label: '営業ナレッジ', icon: BookOpen },
    ],
  },
  {
    key: 'aicamp',
    label: 'AI CAMP',
    items: [
      { href: '/aicamp',         label: 'AI CAMP',         icon: Tent },
      { href: '/product-aicamp', label: 'Product AI CAMP', icon: MonitorPlay },
      { href: '/utage',          label: 'UTAGE',           icon: Zap },
      { href: '/agency-report',  label: '広告レポート',    icon: BarChart3 },
    ],
  },
  {
    key: 'contracts',
    label: '契約・請求',
    withOrderForm: true,
    items: [
      { href: '/advisor',        label: 'AI顧問管理', icon: GanttChartSquare },
      { href: '/contracts',      label: '契約管理',   icon: FileSignature },
      { href: '/invoices',       label: '請求書発行', icon: Receipt },
      { href: '/order-requests', label: '発注リスト', icon: List },
    ],
  },
  {
    key: 'admin',
    label: '管理',
    items: [
      { href: '/settings', label: 'マスタ設定',  icon: Settings },
      { href: '/invites',  label: '招待管理',    icon: UserPlus },
      { href: '/mcp-logs', label: 'MCP実行ログ', icon: ScrollText },
    ],
  },
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
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-white/[0.12] text-white font-semibold' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      <Icon size={16} className={active ? 'text-gold' : 'text-white/45'} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
          {badge}
        </span>
      )}
    </Link>
  )
}

function OrderFormNavItem({ items, onClick }: { items: typeof orderFormSubItems; onClick?: () => void }) {
  const pathname = usePathname()
  const active = items.some(item => pathname.startsWith(item.href))
  const [open, setOpen] = useState(active)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active ? 'bg-white/[0.12] text-white font-semibold' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <FileText size={16} className={active ? 'text-gold' : 'text-white/45'} />
        <span className="flex-1 text-left">発注フォーム</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-5 mt-0.5 pl-3 border-l border-white/10 space-y-0.5">
          {items.map(item => {
            const subActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClick}
                className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  subActive ? 'bg-white/[0.12] text-white font-semibold' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
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

/** グループ見出し（押すと開閉）。中に今いるページがあるときは閉じられない */
function NavGroup({
  label,
  open,
  forcedOpen,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  forcedOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const expanded = open || forcedOpen
  return (
    <div className="pt-2">
      <button
        onClick={onToggle}
        disabled={forcedOpen}
        aria-expanded={expanded}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors disabled:cursor-default ${
          forcedOpen ? 'text-gold' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <ChevronDown size={13} className={`shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        <span className="flex-1 text-left">{label}</span>
      </button>
      {/* 見出しの下に一段下げて並べ、縦のガイド線でグループの範囲を示す */}
      {expanded && <div className="ml-[18px] mt-0.5 pl-2 border-l border-white/10 space-y-0.5">{children}</div>}
    </div>
  )
}

function readOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_OPEN_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function SidebarNav({
  canSee,
  isAdmin,
  allowedPages,
  showNews,
  unreadNews,
  orderFormItems,
  onNavigate,
}: {
  canSee: (href: string) => boolean
  isAdmin: boolean
  allowedPages: string[]
  showNews: boolean
  unreadNews: number
  orderFormItems: typeof orderFormSubItems
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // 開閉状態はブラウザに保存（使えない環境では毎回閉じた状態から始めるだけ）
  useEffect(() => {
    setOpenGroups(readOpenGroups())
  }, [])

  function toggle(key: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(GROUPS_OPEN_KEY, JSON.stringify(next))
      } catch {
        // 保存できなくても開閉自体はできる
      }
      return next
    })
  }

  // 招待管理は admin だけ。それ以外は許可ページで判定
  const visible = (item: NavItem) => (item.href === '/invites' ? isAdmin : canSee(item.href))

  return (
    <>
      {canSee(dashboardItem.href) && <NavLink {...dashboardItem} onClick={onNavigate} />}
      {showNews && <NavLink href="/news" label="お知らせ" icon={Bell} onClick={onNavigate} badge={unreadNews} />}
      {navGroups.map((group) => {
        const items = group.items.filter(visible)
        const orderForm = group.withOrderForm ? orderFormItems : []
        if (items.length === 0 && orderForm.length === 0) return null
        const containsActive =
          items.some((i) => pathname.startsWith(i.href)) || orderForm.some((i) => pathname.startsWith(i.href))
        return (
          <NavGroup
            key={group.key}
            label={group.label}
            open={Boolean(openGroups[group.key])}
            forcedOpen={containsActive}
            onToggle={() => toggle(group.key)}
          >
            {items.map((item) => (
              <NavLink key={item.href} {...item} onClick={onNavigate} />
            ))}
            {orderForm.length > 0 && <OrderFormNavItem items={orderForm} onClick={onNavigate} />}
          </NavGroup>
        )
      })}
      {/* 外部サービス連携は本人の設定なので、許可ページに関係なく社内メンバー全員に出す（代理店は除く） */}
      {(isAdmin || allowedPages.some((p) => p !== '/agency-report')) && (
        <div className="pt-3 mt-2 border-t border-white/10">
          <NavLink href="/integrations" label="外部サービス連携" icon={Link2} onClick={onNavigate} />
        </div>
      )}
    </>
  )
}

function getCookie(name: string): string | undefined {
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [unreadNews, setUnreadNews] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allowedPages, setAllowedPages] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    const role = getCookie('user_role')
    setIsAdmin(role === 'admin')

    const rawPages = getCookie('user_allowed_pages')
    if (rawPages) {
      try {
        setAllowedPages(JSON.parse(decodeURIComponent(rawPages)))
      } catch {
        setAllowedPages([])
      }
    }
  }, [])

  const canSee = (href: string) => isAdmin || allowedPages.some(p => href.startsWith(p))

  const showNews = canSee('/news')
  const visibleOrderFormSubItems = orderFormSubItems.filter(item => canSee(item.href))

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
          <aside className="relative w-64 bg-navy h-full flex flex-col shadow-xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-navy font-black text-sm">K</div>
                <div>
                  <div className="text-sm font-bold text-white">KINDLER</div>
                  <div className="text-xs text-white/55">営業管理</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/55 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              <SidebarNav
                canSee={canSee}
                isAdmin={isAdmin}
                allowedPages={allowedPages}
                showNews={showNews}
                unreadNews={unreadNews}
                orderFormItems={visibleOrderFormSubItems}
                onNavigate={() => setOpen(false)}
              />
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <LogOut size={14} />
                ログアウト
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* デスクトップ サイドバー */}
      <aside className="hidden lg:flex w-60 bg-navy flex-col flex-shrink-0">
        <div className="h-[68px] px-5 flex items-center border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-navy font-black text-base">K</div>
            <div>
              <div className="text-base font-bold text-white">KINDLER</div>
              <div className="text-sm text-white/55">営業管理</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <SidebarNav
            canSee={canSee}
            isAdmin={isAdmin}
            allowedPages={allowedPages}
            showNews={showNews}
            unreadNews={unreadNews}
            orderFormItems={visibleOrderFormSubItems}
          />
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      </aside>
    </>
  )
}
