'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProductAICampSession, ProductAICampCustomer } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2 } from 'lucide-react'

type Tab = 'schedule' | 'customers'

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

const CUSTOMER_STATUSES = ['申込済', 'キャンセル', '修了'] as const

const STATUS_COLORS: Record<string, string> = {
  '申込済':    'bg-blue-100 text-blue-700',
  'キャンセル': 'bg-red-100 text-red-600',
  '修了':      'bg-green-100 text-green-700',
}

// ---------- セッションフォームの初期値 ----------
const emptySession = (): Omit<ProductAICampSession, 'id' | 'created_at'> => ({
  title: '',
  session_date: '',
  end_date: '',
  max_capacity: undefined,
  notes: '',
})

// ---------- 顧客フォームの初期値 ----------
const emptyCustomer = (): Omit<ProductAICampCustomer, 'id' | 'created_at' | 'session'> => ({
  name: '',
  phone: '',
  email: '',
  session_id: '',
  status: '申込済',
  notes: '',
})

export default function ProductAICampPage() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule')

  // セッション
  const [sessions, setSessions] = useState<ProductAICampSession[]>([])
  const [sessionModal, setSessionModal] = useState(false)
  const [sessionDraft, setSessionDraft] = useState(emptySession())
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [savingSession, setSavingSession] = useState(false)

  // 顧客
  const [customers, setCustomers] = useState<ProductAICampCustomer[]>([])
  const [customerModal, setCustomerModal] = useState(false)
  const [customerDraft, setCustomerDraft] = useState(emptyCustomer())
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [savingCustomer, setSavingCustomer] = useState(false)

  // カレンダー
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1) // 1-12

  // エラー
  const [error, setError] = useState<string | null>(null)

  // ---------- フェッチ ----------
  async function fetchAll() {
    const [sessRes, cusRes] = await Promise.all([
      supabase.from('product_aicamp_sessions').select('*').order('session_date'),
      supabase.from('product_aicamp_customers').select('*, session:product_aicamp_sessions(*)').order('created_at', { ascending: false }),
    ])
    if (sessRes.error) setError(sessRes.error.message)
    else setSessions(sessRes.data as ProductAICampSession[])
    if (cusRes.error) setError(cusRes.error.message)
    else setCustomers(cusRes.data as ProductAICampCustomer[])
  }

  useEffect(() => { fetchAll() }, [])

  // ---------- カレンダー計算 ----------
  const calendarData = useMemo(() => {
    const firstDow = new Date(`${calYear}-${String(calMonth).padStart(2, '0')}-01`).getDay()
    const daysInMonth = new Date(calYear, calMonth, 0).getDate()

    // セッションを日付範囲で展開（開始日〜終了日の全日に表示）
    const byDate: Record<string, ProductAICampSession[]> = {}
    sessions.forEach(s => {
      if (!s.session_date) return
      const start = new Date(s.session_date)
      const end = new Date(s.end_date || s.session_date)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10)
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(s)
      }
    })

    return { firstDow, daysInMonth, byDate }
  }, [calYear, calMonth, sessions])

  function shiftMonth(delta: number) {
    let y = calYear
    let m = calMonth + delta
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setCalYear(y)
    setCalMonth(m)
  }

  // ---------- セッション CRUD ----------
  function openNewSession(prefillDate?: string) {
    setEditingSessionId(null)
    const d = emptySession()
    if (prefillDate) {
      const end = new Date(prefillDate)
      end.setDate(end.getDate() + 1)
      d.session_date = prefillDate
      d.end_date = end.toISOString().slice(0, 10)
    }
    setSessionDraft(d)
    setSessionModal(true)
  }

  function openEditSession(s: ProductAICampSession) {
    setEditingSessionId(s.id)
    setSessionDraft({
      title: s.title,
      session_date: s.session_date,
      end_date: s.end_date,
      max_capacity: s.max_capacity,
      notes: s.notes ?? '',
    })
    setSessionModal(true)
  }

  function handleSessionDateChange(date: string) {
    const end = new Date(date)
    end.setDate(end.getDate() + 1)
    setSessionDraft(d => ({
      ...d,
      session_date: date,
      end_date: end.toISOString().slice(0, 10),
    }))
  }

  async function saveSession() {
    if (!sessionDraft.title.trim()) { setError('期名を入力してください'); return }
    if (!sessionDraft.session_date) { setError('開始日を入力してください'); return }
    setError(null)
    setSavingSession(true)
    const payload = {
      title: sessionDraft.title.trim(),
      session_date: sessionDraft.session_date,
      end_date: sessionDraft.end_date || sessionDraft.session_date,
      max_capacity: sessionDraft.max_capacity || null,
      notes: sessionDraft.notes || null,
    }
    if (editingSessionId) {
      const { error: e } = await supabase.from('product_aicamp_sessions').update(payload).eq('id', editingSessionId)
      if (e) { setError(e.message); setSavingSession(false); return }
    } else {
      const { error: e } = await supabase.from('product_aicamp_sessions').insert(payload)
      if (e) { setError(e.message); setSavingSession(false); return }
    }
    setSavingSession(false)
    setSessionModal(false)
    fetchAll()
  }

  async function deleteSession(id: string) {
    if (!confirm('このセッションを削除しますか？')) return
    await supabase.from('product_aicamp_sessions').delete().eq('id', id)
    fetchAll()
  }

  // ---------- 顧客 CRUD ----------
  function openNewCustomer() {
    setEditingCustomerId(null)
    setCustomerDraft(emptyCustomer())
    setCustomerModal(true)
  }

  function openEditCustomer(c: ProductAICampCustomer) {
    setEditingCustomerId(c.id)
    setCustomerDraft({
      name: c.name,
      phone: c.phone,
      email: c.email,
      session_id: c.session_id ?? '',
      status: c.status,
      notes: c.notes ?? '',
    })
    setCustomerModal(true)
  }

  async function saveCustomer() {
    if (!customerDraft.name.trim()) { setError('顧客名を入力してください'); return }
    if (!customerDraft.phone.trim()) { setError('電話番号を入力してください'); return }
    if (!customerDraft.email.trim()) { setError('メールアドレスを入力してください'); return }
    setError(null)
    setSavingCustomer(true)
    const payload = {
      name: customerDraft.name.trim(),
      phone: customerDraft.phone.trim(),
      email: customerDraft.email.trim(),
      session_id: customerDraft.session_id || null,
      status: customerDraft.status,
      notes: customerDraft.notes || null,
    }
    if (editingCustomerId) {
      const { error: e } = await supabase.from('product_aicamp_customers').update(payload).eq('id', editingCustomerId)
      if (e) { setError(e.message); setSavingCustomer(false); return }
    } else {
      const { error: e } = await supabase.from('product_aicamp_customers').insert(payload)
      if (e) { setError(e.message); setSavingCustomer(false); return }
    }
    setSavingCustomer(false)
    setCustomerModal(false)
    fetchAll()
  }

  async function deleteCustomer(id: string) {
    if (!confirm('この顧客を削除しますか？')) return
    await supabase.from('product_aicamp_customers').delete().eq('id', id)
    fetchAll()
  }

  // ---------- 描画 ----------
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Product AI CAMP</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {/* タブ */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {([['schedule', '開催スケジュール'], ['customers', '顧客一覧']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===== 開催スケジュール タブ ===== */}
      {activeTab === 'schedule' && (
        <div>
          {/* カレンダーヘッダー */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => shiftMonth(-1)} className="p-1 text-slate-500 hover:text-slate-900">
                <ChevronLeft size={18} />
              </button>
              <span className="text-base font-semibold text-slate-800 w-28 text-center">
                {calYear}年{calMonth}月
              </span>
              <button onClick={() => shiftMonth(1)} className="p-1 text-slate-500 hover:text-slate-900">
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={() => openNewSession()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              セッション追加
            </button>
          </div>

          {/* カレンダーグリッド */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 border-b border-slate-200">
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  className={`py-2 text-center text-xs font-medium ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 日付セル */}
            <div className="grid grid-cols-7">
              {/* 空白セル */}
              {Array.from({ length: calendarData.firstDow }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[90px] border-b border-r border-slate-100 bg-slate-50" />
              ))}
              {/* 日付 */}
              {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                const day = i + 1
                const dow = (calendarData.firstDow + i) % 7
                const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const daySessions = calendarData.byDate[dateStr] ?? []
                const isToday = dateStr === new Date().toISOString().slice(0, 10)

                return (
                  <div
                    key={day}
                    className="min-h-[90px] border-b border-r border-slate-100 p-1.5 cursor-pointer hover:bg-blue-50/50 transition-colors"
                    onClick={() => openNewSession(dateStr)}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full mb-1 ${
                        isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : dow === 0
                          ? 'text-red-500'
                          : dow === 6
                          ? 'text-blue-500'
                          : 'text-slate-700'
                      }`}
                    >
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {daySessions.map(s => (
                        <div
                          key={s.id}
                          className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-blue-200"
                          onClick={e => { e.stopPropagation(); openEditSession(s) }}
                          title={s.title}
                        >
                          {s.title}
                          {s.max_capacity ? ` (定員${s.max_capacity})` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* セッション一覧 */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">セッション一覧</h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400">セッションがまだありません</p>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900">{s.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {s.session_date} 〜 {s.end_date}
                        {s.max_capacity ? `　定員 ${s.max_capacity}名` : ''}
                      </div>
                      {s.notes && <div className="text-xs text-slate-400 mt-0.5">{s.notes}</div>}
                    </div>
                    <button
                      onClick={() => openEditSession(s)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 顧客一覧 タブ ===== */}
      {activeTab === 'customers' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={openNewCustomer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              顧客登録
            </button>
          </div>

          {customers.length === 0 ? (
            <p className="text-sm text-slate-400">顧客がまだ登録されていません</p>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">顧客名</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">電話番号</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">メールアドレス</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">参加セッション</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">登録日</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                      <td className="px-4 py-3 text-slate-600">{c.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.session ? (
                          <span className="text-blue-700">
                            {c.session.title}
                            <span className="text-slate-400 ml-1 text-xs">
                              ({c.session.session_date})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">未選択</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {c.created_at.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditCustomer(c)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteCustomer(c.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== セッションモーダル ===== */}
      {sessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                {editingSessionId ? 'セッション編集' : 'セッション追加'}
              </h2>
              <button onClick={() => setSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">期名 *</label>
                <input
                  className="input"
                  placeholder="例: 第3期"
                  value={sessionDraft.title}
                  onChange={e => setSessionDraft(d => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">開始日 *</label>
                  <input
                    type="date"
                    className="input"
                    value={sessionDraft.session_date}
                    onChange={e => handleSessionDateChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">終了日</label>
                  <input
                    type="date"
                    className="input"
                    value={sessionDraft.end_date}
                    onChange={e => setSessionDraft(d => ({ ...d, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">定員</label>
                <input
                  type="number"
                  className="input"
                  placeholder="例: 20"
                  value={sessionDraft.max_capacity ?? ''}
                  onChange={e => setSessionDraft(d => ({ ...d, max_capacity: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メモ</label>
                <textarea
                  className="input"
                  rows={2}
                  value={sessionDraft.notes ?? ''}
                  onChange={e => setSessionDraft(d => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button
                onClick={() => setSessionModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={saveSession}
                disabled={savingSession}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingSession ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 顧客モーダル ===== */}
      {customerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                {editingCustomerId ? '顧客編集' : '顧客登録'}
              </h2>
              <button onClick={() => setCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">顧客名 *</label>
                <input
                  className="input"
                  placeholder="例: 山田 太郎"
                  value={customerDraft.name}
                  onChange={e => setCustomerDraft(d => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">電話番号 *</label>
                <input
                  className="input"
                  placeholder="例: 090-1234-5678"
                  value={customerDraft.phone}
                  onChange={e => setCustomerDraft(d => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メールアドレス *</label>
                <input
                  type="email"
                  className="input"
                  placeholder="例: yamada@example.com"
                  value={customerDraft.email}
                  onChange={e => setCustomerDraft(d => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">参加セッション</label>
                <select
                  className="input"
                  value={customerDraft.session_id ?? ''}
                  onChange={e => setCustomerDraft(d => ({ ...d, session_id: e.target.value }))}
                >
                  <option value="">未選択</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title}（{s.session_date}〜{s.end_date}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ステータス</label>
                <select
                  className="input"
                  value={customerDraft.status}
                  onChange={e => setCustomerDraft(d => ({ ...d, status: e.target.value }))}
                >
                  {CUSTOMER_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メモ</label>
                <textarea
                  className="input"
                  rows={2}
                  value={customerDraft.notes ?? ''}
                  onChange={e => setCustomerDraft(d => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button
                onClick={() => setCustomerModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={saveCustomer}
                disabled={savingCustomer}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingCustomer ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
