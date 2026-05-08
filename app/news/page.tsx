'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase, News, Feedback } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'kindler-admin'
const NEWS_READ_KEY = 'kindler_news_read'

const NEWS_CATEGORIES = ['機能追加', 'バグ修正', 'お知らせ']
const FEEDBACK_CATEGORIES = ['要望', 'バグ報告', 'その他']

function categoryColor(cat: string) {
  if (cat === '機能追加') return 'bg-blue-100 text-blue-700'
  if (cat === 'バグ修正') return 'bg-red-100 text-red-600'
  return 'bg-slate-100 text-slate-600'
}

type Tab = 'news' | 'feedback' | 'admin-feedback'

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [tab, setTab] = useState<Tab>('news')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postCategory, setPostCategory] = useState('お知らせ')
  const [postFaq, setPostFaq] = useState(false)
  const [posting, setPosting] = useState(false)

  const [fbCategory, setFbCategory] = useState('その他')
  const [fbBody, setFbBody] = useState('')
  const [fbName, setFbName] = useState('')
  const [fbSending, setFbSending] = useState(false)
  const [fbSent, setFbSent] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NEWS_READ_KEY)
      if (stored) setReadIds(new Set(JSON.parse(stored)))
    } catch {}
    if (sessionStorage.getItem('kindler_admin') === '1') setIsAdmin(true)
    fetchNews()
  }, [])

  useEffect(() => {
    if (isAdmin) fetchFeedback()
  }, [isAdmin])

  async function fetchNews() {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false })
    if (data) setNews(data)
  }

  async function fetchFeedback() {
    const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
    if (data) setFeedback(data)
  }

  function markRead(id: string) {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(NEWS_READ_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  function markAllRead() {
    const next = new Set([...readIds, ...news.map(n => n.id)])
    setReadIds(next)
    try { localStorage.setItem(NEWS_READ_KEY, JSON.stringify([...next])) } catch {}
  }

  function handleAdminLogin() {
    if (pwInput === ADMIN_PASSWORD) {
      setIsAdmin(true)
      sessionStorage.setItem('kindler_admin', '1')
      setShowAdminLogin(false)
      setPwInput('')
      setPwError(false)
    } else {
      setPwError(true)
    }
  }

  async function handlePost() {
    if (!postTitle.trim() || !postBody.trim()) return
    setPosting(true)
    await supabase.from('news').insert({ title: postTitle, body: postBody, category: postCategory, is_faq: postFaq })
    setPostTitle(''); setPostBody(''); setPostCategory('お知らせ'); setPostFaq(false)
    setPosting(false)
    fetchNews()
  }

  async function toggleArchive(item: News) {
    await supabase.from('news').update({ archived: !item.archived }).eq('id', item.id)
    fetchNews()
  }

  async function toggleFaq(item: News) {
    await supabase.from('news').update({ is_faq: !item.is_faq }).eq('id', item.id)
    fetchNews()
  }

  async function handleFeedback() {
    if (!fbBody.trim()) return
    setFbSending(true)
    await supabase.from('feedback').insert({ category: fbCategory, body: fbBody, member_name: fbName || null })
    setFbBody(''); setFbName('')
    setFbSending(false)
    setFbSent(true)
    setTimeout(() => setFbSent(false), 3000)
  }

  const visibleNews = useMemo(
    () => news.filter(n => showArchived ? true : !n.archived),
    [news, showArchived]
  )

  const unreadCount = useMemo(
    () => news.filter(n => !n.archived && !readIds.has(n.id)).length,
    [news, readIds]
  )

  return (
    <div className="space-y-6 pb-8 max-w-3xl">
      <PageHeader
        title="お知らせ"
        sub="機能追加・バグ修正・アップデート情報"
        right={
          isAdmin ? (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">管理者モード</span>
          ) : (
            <button onClick={() => setShowAdminLogin(true)} className="text-xs text-slate-400 hover:text-slate-600 transition px-2 py-1">管理者ログイン</button>
          )
        }
      />

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-slate-800 mb-4">管理者パスワード</h3>
            <input
              type="password"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              className="input w-full mb-2"
              placeholder="パスワードを入力"
              autoFocus
            />
            {pwError && <p className="text-xs text-red-500 mb-2">パスワードが違います</p>}
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => { setShowAdminLogin(false); setPwInput(''); setPwError(false) }} className="text-sm text-slate-500 px-3 py-1.5 hover:text-slate-700 transition">キャンセル</button>
              <button onClick={handleAdminLogin} className="text-sm font-bold bg-[#1a3a6e] text-white px-4 py-1.5 rounded-lg hover:bg-[#152f5a] transition">ログイン</button>
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-0 border-b border-slate-200">
        <button
          onClick={() => setTab('news')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${tab === 'news' ? 'border-[#1a3a6e] text-[#1a3a6e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          お知らせ
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">{unreadCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('feedback')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'feedback' ? 'border-[#1a3a6e] text-[#1a3a6e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          声を届ける
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('admin-feedback')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'admin-feedback' ? 'border-[#1a3a6e] text-[#1a3a6e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            フィードバック一覧
            {feedback.length > 0 && <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">{feedback.length}</span>}
          </button>
        )}
      </div>

      {/* お知らせタブ */}
      {tab === 'news' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">新規投稿</p>
              <input value={postTitle} onChange={e => setPostTitle(e.target.value)} className="input w-full" placeholder="タイトル" />
              <textarea value={postBody} onChange={e => setPostBody(e.target.value)} className="input w-full h-24 resize-none" placeholder="本文" />
              <div className="flex items-center gap-3 flex-wrap">
                <select value={postCategory} onChange={e => setPostCategory(e.target.value)} className="input text-sm">
                  {NEWS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={postFaq} onChange={e => setPostFaq(e.target.checked)} />
                  FAQ化
                </label>
                <button onClick={handlePost} disabled={posting || !postTitle.trim() || !postBody.trim()} className="ml-auto px-4 py-1.5 bg-[#1a3a6e] text-white text-sm font-bold rounded-lg hover:bg-[#152f5a] transition disabled:opacity-40">
                  {posting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 min-h-[28px]">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-slate-600 transition">すべて既読にする</button>
            )}
            {isAdmin && (
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-auto">
                <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                アーカイブを表示
              </label>
            )}
          </div>

          {visibleNews.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-16">お知らせはまだありません</p>
          )}

          {visibleNews.map(item => {
            const isNew = !readIds.has(item.id) && !item.archived
            return (
              <div
                key={item.id}
                onClick={() => markRead(item.id)}
                className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition hover:shadow-md ${item.archived ? 'opacity-50 border-slate-100' : isNew ? 'border-blue-200' : 'border-[#e0e6f0]'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryColor(item.category)}`}>{item.category}</span>
                      {item.is_faq && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">FAQ</span>}
                      {isNew && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">NEW</span>}
                      {item.archived && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">アーカイブ</span>}
                    </div>
                    <h3 className="font-bold text-slate-800">{item.title}</h3>
                    <p className="text-slate-500 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{item.body}</p>
                    <p className="text-xs text-slate-300 mt-3">
                      {new Date(item.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleFaq(item)} className={`text-[10px] px-2 py-1 rounded font-medium transition border ${item.is_faq ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-slate-200 text-slate-400 hover:border-amber-300'}`}>
                        {item.is_faq ? 'FAQ解除' : 'FAQ化'}
                      </button>
                      <button onClick={() => toggleArchive(item)} className={`text-[10px] px-2 py-1 rounded font-medium transition border ${item.archived ? 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400' : 'border-slate-200 text-slate-400 hover:border-slate-400'}`}>
                        {item.archived ? '復元' : 'アーカイブ'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 声を届けるタブ */}
      {tab === 'feedback' && (
        <div className="bg-white rounded-xl border border-[#e0e6f0] shadow-sm p-6 space-y-4 max-w-lg">
          <p className="text-sm text-slate-500">要望・バグ報告など、気軽に送ってください。</p>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">カテゴリ</label>
            <select value={fbCategory} onChange={e => setFbCategory(e.target.value)} className="input w-full">
              {FEEDBACK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">内容</label>
            <textarea value={fbBody} onChange={e => setFbBody(e.target.value)} className="input w-full h-28 resize-none" placeholder="気になること・改善してほしいことを書いてください" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">名前（任意）</label>
            <input value={fbName} onChange={e => setFbName(e.target.value)} className="input w-full" placeholder="匿名でもOK" />
          </div>
          {fbSent ? (
            <p className="text-sm font-bold text-green-600 py-1">送信しました。ありがとうございます！</p>
          ) : (
            <button onClick={handleFeedback} disabled={fbSending || !fbBody.trim()} className="px-5 py-2 bg-[#1a3a6e] text-white text-sm font-bold rounded-lg hover:bg-[#152f5a] transition disabled:opacity-40">
              {fbSending ? '送信中...' : '送信する'}
            </button>
          )}
        </div>
      )}

      {/* 管理者: フィードバック一覧 */}
      {tab === 'admin-feedback' && isAdmin && (
        <div className="space-y-3">
          {feedback.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-16">フィードバックはまだありません</p>
          )}
          {feedback.map(fb => (
            <div key={fb.id} className="bg-white rounded-xl border border-[#e0e6f0] shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{fb.category}</span>
                {fb.member_name && <span className="text-xs text-slate-500 font-medium">{fb.member_name}</span>}
                <span className="text-xs text-slate-300 ml-auto">
                  {new Date(fb.created_at).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{fb.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
