'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { supabase, News } from '@/lib/supabase'

const NEWS_READ_KEY = 'kindler_news_read'

const CATEGORY_COLORS: Record<string, string> = {
  '機能追加': 'bg-blue-100 text-blue-700',
  '仕様変更': 'bg-amber-100 text-amber-700',
  'バグ修正': 'bg-red-100 text-red-600',
  'お知らせ': 'bg-slate-100 text-slate-600',
}

export default function NewsBell() {
  const [open, setOpen] = useState(false)
  const [news, setNews] = useState<News[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [unreadBeforeOpen, setUnreadBeforeOpen] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('news')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) setNews(data)
    }
    load()
    try {
      const stored = localStorage.getItem(NEWS_READ_KEY)
      setReadIds(new Set(stored ? JSON.parse(stored) : []))
    } catch {}
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = news.filter(n => !readIds.has(n.id)).length

  function toggleDropdown() {
    if (!open) {
      const unread = new Set(news.filter(n => !readIds.has(n.id)).map(n => n.id))
      setUnreadBeforeOpen(unread)
      const newReadIds = new Set([...readIds, ...news.map(n => n.id)])
      setReadIds(newReadIds)
      try { localStorage.setItem(NEWS_READ_KEY, JSON.stringify([...newReadIds])) } catch {}
    }
    setOpen(o => !o)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">お知らせ</p>
          </div>
          {news.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">お知らせはありません</div>
          ) : (
            <ul>
              {news.map(n => {
                const isNew = unreadBeforeOpen.has(n.id)
                const colorClass = CATEGORY_COLORS[n.category] ?? 'bg-slate-100 text-slate-600'
                return (
                  <li key={n.id} className="border-b border-slate-50 last:border-0">
                    <Link
                      href="/news"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>{n.category}</span>
                        {isNew && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">NEW</span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto">{n.created_at.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-slate-800 font-medium leading-snug line-clamp-2">{n.title}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <Link
              href="/news"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-navy hover:underline"
            >
              お知らせをすべて見る
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
