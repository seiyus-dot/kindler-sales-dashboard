'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, BriefcaseBusiness, ClipboardList, Settings, Users, Menu, X, BookOpen, LogOut, Tent, UserPlus } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

const navItems = [
  { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/deals',     label: '法人案件',       icon: BriefcaseBusiness },
  { href: '/weekly',    label: '週次ログ',       icon: ClipboardList },
  { href: '/members',   label: 'メンバー',       icon: Users },
  { href: '/settings',  label: 'マスタ設定',     icon: Settings },
  { href: '/knowledge', label: '営業ナレッジ',   icon: BookOpen },
  { href: '/aicamp',   label: 'AI CAMP',        icon: Tent },
  { href: '/invites',  label: '招待管理',        icon: UserPlus },
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

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1]
}

export function useUserRole() {
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [allowedPages, setAllowedPages] = useState<string[]>(['/aicamp'])

  useEffect(() => {
    const r = getCookie('user_role') as 'admin' | 'member' | undefined
    const p = getCookie('user_allowed_pages')
    setRole(r ?? 'member')
    setAllowedPages(p ? JSON.parse(decodeURIComponent(p)) : ['/aicamp'])
  }, [])

  return { role, allowedPages }
}

function UserFooter({ onClose }: { onClose?: () => void }) {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    onClose?.()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div className="px-4 py-4 border-t border-slate-100">
      <div className="flex items-center gap-2.5 mb-2">
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt=""
            className="w-7 h-7 rounded-full"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
            {user.email?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-700 truncate">
            {user.user_metadata?.full_name || user.email}
          </div>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <LogOut size={14} />
        ログアウト
      </button>
    </div>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const { role, allowedPages } = useUserRole()

  const visibleNavItems = role === 'admin'
    ? navItems
    : navItems.filter((item) => allowedPages.some((p) => item.href.startsWith(p)))

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
              {visibleNavItems.map(item => (
                <NavLink key={item.href} {...item} onClick={() => setOpen(false)} />
              ))}
            </nav>
            <UserFooter onClose={() => setOpen(false)} />
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
          {visibleNavItems.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <UserFooter />
      </aside>
    </>
  )
}
