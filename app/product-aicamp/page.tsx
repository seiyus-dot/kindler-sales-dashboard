'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProductAICampSession, ProductAICampCustomer } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, Users } from 'lucide-react'

type Tab = 'schedule' | 'customers'

type ParticipantsModalState = {
  session: ProductAICampSession
} | null

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

const CUSTOMER_STATUSES = ['申込済', 'キャンセル', '修了'] as const

const STATUS_COLORS: Record<string, string> = {
  '申込済':    'bg-blue-100 text-blue-700',
  'キャンセル': 'bg-red-100 text-red-600',
  '修了':      'bg-green-100 text-green-700',
}

const emptySession = (): Omit<ProductAICampSession, 'id' | 'created_at'> => ({
  title: '',
  session_date: '',
  end_date: '',
  max_capacity: undefined,
  notes: '',
})

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

  const [sessions, setSessions] = useState<ProductAICampSession[]>([])
  const [sessionModal, setSessionModal] = useState(false)
  const [sessionDraft, setSessionDraft] = useState(emptySession())
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [savingSession, setSavingSession] = useState(false)

  const [customers, setCustomers] = useState<ProductAICampCustomer[]>([])
  const [customerModal, setCustomerModal] = useState(false)
  const [customerDraft, setCustomerDraft] = useState(emptyCustomer())
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [savingCustomer, setSavingCustomer] = useState(false)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)

  const [participantsModal, setParticipantsModal] = useState<ParticipantsModalState>(null)
  const [error, setError] = useState<string | null>(null)

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

  const calendarData = useMemo(() => {
    const firstDow = new Date(`${calYear}-${String(calMonth).padStart(2, '0')}-01`).getDay()
    const daysInMonth = new Date(calYear, calMonth, 0).getDate()
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

  function goToday() {
    const t = new Date()
    setCalYear(t.getFullYear())
    setCalMonth(t.getMonth() + 1)
  }

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

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Product AI CAMP</h1>
        <p className="text-sm text-gray-400 mt-0.5">{sessions.length}セッション / 受講者 {customers.filter(c => c.status !== 'キャンセル').length}名</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>
      )}

      {/* タブ */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['schedule', '開催スケジュール'], ['customers', '顧客一覧']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-navy text-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===== 開催スケジュール タブ ===== */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-12 gap-6">

          {/* 左カラム: カレンダー */}
          <section className="col-span-12 xl:col-span-8 space-y-4">
            {/* カレンダーナビ */}
            <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-[#e0e6f0] shadow-sm">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-gray-900">{calYear}年{calMonth}月</h2>
                <div className="flex border border-[#e0e6f0] rounded-lg overflow-hidden">
                  <button onClick={() => shiftMonth(-1)} className="p-1.5 hover:bg-slate-50 border-r border-[#e0e6f0] text-gray-500 transition-colors">
                    <ChevronLeft size={15} />
                  </button>
                  <button onClick={() => shiftMonth(1)} className="p-1.5 hover:bg-slate-50 text-gray-500 transition-colors">
                    <ChevronRight size={15} />
                  </button>
                </div>
                <button
                  onClick={goToday}
                  className="text-xs font-bold text-navy bg-[#eef1ff] px-3 py-1.5 rounded-full hover:bg-[#dde3ff] transition-colors"
                >
                  今日
                </button>
              </div>
            </div>

            {/* カレンダーグリッド */}
            <div className="bg-white rounded-2xl border border-[#e0e6f0] shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 border-b border-[#e0e6f0]">
                {DAYS.map((d, i) => (
                  <div
                    key={d}
                    className={`py-3 text-center text-[11px] font-bold tracking-wider uppercase ${
                      i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {Array.from({ length: calendarData.firstDow }).map((_, i) => (
                  <div key={`blank-${i}`} className="aspect-[4/3] border-b border-r border-slate-50 bg-slate-50/40" />
                ))}
                {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dow = (calendarData.firstDow + i) % 7
                  const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const daySessions = calendarData.byDate[dateStr] ?? []
                  const isToday = dateStr === todayStr
                  const isWeekend = dow === 0 || dow === 6

                  return (
                    <div
                      key={day}
                      onClick={() => openNewSession(dateStr)}
                      className={`aspect-[4/3] p-2 border-b border-r border-slate-50 cursor-pointer hover:bg-blue-50/50 transition-colors group ${isWeekend ? 'bg-slate-50/40' : ''}`}
                    >
                      <div className="flex flex-col h-full">
                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full mb-1 ${
                          isToday
                            ? 'bg-navy text-white shadow-sm'
                            : dow === 0 ? 'text-rose-500'
                            : dow === 6 ? 'text-blue-500'
                            : 'text-slate-500'
                        }`}>
                          {day}
                        </span>
                        <div className="mt-auto space-y-0.5">
                          {daySessions.map(s => (
                            <div
                              key={s.id}
                              onClick={e => { e.stopPropagation(); openEditSession(s) }}
                              title={s.title}
                              className="h-1.5 w-full rounded-full bg-navy/60 hover:bg-navy transition-colors"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* 右カラム: セッション一覧 */}
          <section className="col-span-12 xl:col-span-4 space-y-4">
            <button
              onClick={() => openNewSession()}
              className="w-full flex items-center justify-center gap-2 bg-[#1a2540] hover:bg-navy text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-[0.98]"
            >
              <Plus size={18} />
              セッションを追加
            </button>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">今後のセッション</h3>
                <span className="text-xs text-gray-400">{sessions.length}件</span>
              </div>

              {sessions.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex items-center justify-center">
                  <p className="text-xs font-medium text-gray-400">セッションがありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(s => {
                    const participantCount = customers.filter(c => c.session_id === s.id && c.status !== 'キャンセル').length
                    const isPast = s.end_date < todayStr
                    const isOngoing = s.session_date <= todayStr && s.end_date >= todayStr
                    const sessionStatus = isPast ? '終了' : isOngoing ? '開催中' : '開催予定'
                    const sessionStatusColor =
                      isPast ? 'bg-slate-100 text-slate-500'
                      : isOngoing ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'

                    return (
                      <div
                        key={s.id}
                        onClick={() => setParticipantsModal({ session: s })}
                        className="bg-white p-4 rounded-2xl border border-[#e0e6f0] shadow-sm hover:border-navy/30 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sessionStatusColor}`}>
                            {sessionStatus}
                          </span>
                          <div
                            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => openEditSession(s)}
                              className="p-1.5 text-slate-400 hover:text-navy hover:bg-[#eef1ff] rounded-lg transition-all"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deleteSession(s.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-gray-800 group-hover:text-navy transition-colors text-sm mb-1">
                          {s.title}
                        </h4>
                        <p className="text-xs text-gray-400 mb-3">
                          {s.session_date} 〜 {s.end_date}
                        </p>
                        <div className="flex items-center pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Users size={13} />
                            <span className="text-xs font-bold">
                              {participantCount}名
                              {s.max_capacity ? ` / 定員 ${s.max_capacity}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div className="border-2 border-dashed border-gray-100 rounded-2xl p-6 flex items-center justify-center">
                    <p className="text-xs text-gray-300 font-medium">これ以降の予定はありません</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ===== 顧客一覧 タブ ===== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openNewCustomer}
              className="flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm rounded-lg hover:bg-[#152f5a] transition-colors font-medium"
            >
              <Plus size={15} />
              顧客登録
            </button>
          </div>

          {customers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">顧客がまだ登録されていません</p>
          ) : (
            <div className="bg-white rounded-xl border border-[#e0e6f0] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e0e6f0] bg-[#f8f9fd]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">顧客名</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">電話番号</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">メールアドレス</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">参加セッション</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ステータス</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">登録日</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2fa]">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-[#f8f9fd] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{c.email}</td>
                      <td className="px-4 py-3">
                        {c.session ? (
                          <span className="text-navy font-medium">
                            {c.session.title}
                            <span className="text-gray-400 ml-1 text-xs">({c.session.session_date})</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">未選択</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{c.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditCustomer(c)} className="p-1.5 text-gray-400 hover:text-navy transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteCustomer(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
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
                className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-[#152f5a] disabled:opacity-50 transition-colors"
              >
                {savingSession ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 参加者モーダル ===== */}
      {participantsModal && (() => {
        const s = participantsModal.session
        const participants = customers.filter(c => c.session_id === s.id)
        const active = participants.filter(c => c.status !== 'キャンセル')
        const cancelled = participants.filter(c => c.status === 'キャンセル')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{s.title} — 参加者一覧</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.session_date} 〜 {s.end_date}
                    {s.max_capacity ? `　定員 ${s.max_capacity}名` : ''}
                  </p>
                </div>
                <button onClick={() => setParticipantsModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4">
                {participants.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">まだ参加者が登録されていません</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-600">参加 ({active.length}名)</span>
                        {s.max_capacity && (
                          <span className="text-xs text-slate-400">残り {Math.max(0, s.max_capacity - active.length)}席</span>
                        )}
                      </div>
                      {active.length === 0 ? (
                        <p className="text-xs text-slate-400 pl-1">なし</p>
                      ) : (
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {active.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900">{c.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{c.email}</div>
                              </div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                {c.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {cancelled.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-2">キャンセル ({cancelled.length}名)</div>
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 opacity-60">
                          {cancelled.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900 line-through">{c.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{c.email}</div>
                              </div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                {c.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="px-6 pb-5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setParticipantsModal(null)}
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
                className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-[#152f5a] disabled:opacity-50 transition-colors"
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
