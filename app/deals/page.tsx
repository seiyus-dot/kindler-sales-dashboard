'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, DealToB, DealAction, Member, MasterOption, ColumnConfig } from '@/lib/supabase'
import DealToBForm from '@/components/DealToBForm'
import CSVImport from '@/components/CSVImport'
import StripeCSVImport from '@/components/StripeCSVImport'
import AIImport from '@/components/AIImport'
import PageHeader from '@/components/PageHeader'

const TOB_STATUSES = ['アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'リード', '受注', '失注', '保留']
const PRIORITIES = ['高', '中', '低']

const TOB_COL_MIN_WIDTH: Record<string, string> = {
  member:           'min-w-[80px]',
  sub_member:       'min-w-[80px]',
  company_name:     'min-w-[160px]',
  contact_name:     'min-w-[160px]',
  status:           'min-w-[100px]',
  priority:         'min-w-[70px]',
  expected_amount:  'min-w-[90px]',
  weighted_amount:  'min-w-[90px]',
  win_probability:  'min-w-[70px]',
  service:          'min-w-[120px]',
  industry:         'min-w-[100px]',
  source:           'min-w-[100px]',
  next_action_date:   'min-w-[110px]',
  next_action:        'min-w-[160px]',
  notes:              'min-w-[200px]',
  latest_meeting_at:  'min-w-[120px]',
  video_url:          'min-w-[60px]',
  minutes_text:       'min-w-[180px]',
}
const TOB_COL_NOWRAP = new Set(['notes'])

export default function DealsPage() {
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [tobCols, setTobCols] = useState<ColumnConfig[]>([])
  const [sources, setSources] = useState<MasterOption[]>([])
  const [services, setServices] = useState<MasterOption[]>([])
  const [industries, setIndustries] = useState<MasterOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<DealToB | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterMember, setFilterMember] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'kanban' | 'deals'>('overview')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [latestMeetings, setLatestMeetings] = useState<Map<string, DealAction>>(new Map())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [kpiModal, setKpiModal] = useState<'sales' | 'paid' | 'pipeline' | 'weighted' | null>(null)

  function shiftMonth(ym: string, delta: number): string {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [tobRes, membersRes, colRes, srcRes, svcRes, indRes, meetingRes] = await Promise.all([
      supabase.from('deals_tob').select('*, member:members!member_id(name), sub_member:members!sub_member_id(name)').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('column_config').select('*').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'source').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'service').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'industry').order('sort_order'),
      supabase.from('deal_actions').select('*').eq('deal_type', 'tob').eq('action_type', '商談').order('action_date', { ascending: false }),
    ])
    if (tobRes.data) setTobDeals(tobRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    if (colRes.data) setTobCols(colRes.data.filter((c: ColumnConfig) => c.table_type === 'tob' && c.visible))
    if (srcRes.data) setSources(srcRes.data)
    if (svcRes.data) setServices(svcRes.data)
    if (indRes.data) setIndustries(indRes.data)
    if (meetingRes.data) {
      const map = new Map<string, DealAction>()
      for (const a of meetingRes.data) {
        if (!map.has(a.deal_id)) map.set(a.deal_id, a)
      }
      setLatestMeetings(map)
    }
  }

  function startEdit(deal: DealToB) {
    setEditingId(deal.id)
    setDraft({
      member_id: deal.member_id ?? '',
      company_name: deal.company_name ?? '',
      contact_name: deal.contact_name ?? '',
      industry: deal.industry ?? '',
      status: deal.status ?? '',
      priority: deal.priority ?? '',
      expected_amount: deal.expected_amount?.toString() ?? '',
      win_probability: deal.win_probability?.toString() ?? '',
      source: deal.source ?? '',
      service: deal.service ?? '',
      next_action: deal.next_action ?? '',
      next_action_date: deal.next_action_date ?? '',
      notes: deal.notes ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({})
    setShowConfirm(false)
  }

  async function confirmSave() {
    if (!editingId) return
    setSaving(true)
    const payload: Record<string, string | number | null> = {}
    Object.entries(draft).forEach(([k, v]) => {
      if (['expected_amount', 'win_probability'].includes(k)) {
        payload[k] = v ? parseInt(v) : null
      } else {
        payload[k] = v || null
      }
    })
    await supabase.from('deals_tob').update(payload).eq('id', editingId)
    setSaving(false)
    setShowConfirm(false)
    setEditingId(null)
    setDraft({})
    fetchAll()
  }

  async function deleteDeal(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('deals_tob').delete().eq('id', id)
    fetchAll()
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return
    setBulkDeleting(true)
    await supabase.from('deals_tob').delete().in('id', Array.from(selectedIds))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    fetchAll()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === activeDeals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(activeDeals.map(d => d.id)))
    }
  }

  const set = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }))

  const statusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-500'
    if (status === '受注') return 'bg-green-100 text-green-700'
    if (status === '失注') return 'bg-red-100 text-red-600'
    if (['交渉中', '提案済'].includes(status)) return 'bg-[#e8eeff] text-navy'
    if (['商談中', 'アポ取得'].includes(status)) return 'bg-[#f0eeff] text-[#4a3a8e]'
    if (status === '保留') return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-600'
  }

  const priorityColor = (p?: string) => {
    if (p === '高') return 'text-red-500 font-bold'
    if (p === '中') return 'text-amber-500'
    return 'text-gray-400'
  }

  const cellInput = (k: string, type = 'text') => (
    <input
      type={type}
      value={draft[k] ?? ''}
      onChange={e => set(k, e.target.value)}
      className="w-full border border-[#b8c8e8] rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-navy bg-[#f0f4ff]"
    />
  )

  const cellSelect = (k: string, options: string[]) => (
    <select
      value={draft[k] ?? ''}
      onChange={e => set(k, e.target.value)}
      className="w-full border border-[#b8c8e8] rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-navy bg-[#f0f4ff]"
    >
      <option value="">-</option>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  const memberSelect = () => (
    <select
      value={draft.member_id ?? ''}
      onChange={e => set('member_id', e.target.value)}
      className="w-full border border-[#b8c8e8] rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-navy bg-[#f0f4ff]"
    >
      <option value="">-</option>
      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderViewCell(col: string, deal: DealToB) {
    const d = deal as any
    switch (col) {
      case 'member':
      case 'member_id':     return <span className="font-medium">{d.member?.name ?? '-'}</span>
      case 'sub_member':    return <span className="text-gray-500">{d.sub_member?.name ?? '-'}</span>
      case 'status':        return <span className={`px-2 py-0.5 rounded text-sm font-medium ${statusColor(d.status)}`}>{d.status ?? '-'}</span>
      case 'priority':      return <span className={priorityColor(d.priority)}>{d.priority ?? '-'}</span>
      case 'expected_amount': return <span className="text-right block font-mono">{d.expected_amount?.toLocaleString() ?? '-'}</span>
      case 'weighted_amount': {
        const amt = d.expected_amount ?? null
        const prob = d.win_probability ?? null
        if (amt === null || prob === null) return <span className="text-gray-300">-</span>
        const val = Math.round(amt * prob / 100)
        return <span className="text-right block font-mono text-navy font-medium">{val.toLocaleString()}</span>
      }
      case 'win_probability': {
        const pct = d.win_probability ?? null
        if (pct === null) return <span className="text-gray-300">-</span>
        const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-navy' : 'bg-gray-300'
        return (
          <div className="flex items-center gap-2">
            <div className="w-14 bg-gray-100 h-1.5 rounded overflow-hidden flex-shrink-0">
              <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-mono text-gray-600 tabular-nums">{pct}%</span>
          </div>
        )
      }
      case 'next_action_date': return <span className="text-gray-500">{d.next_action_date ?? '-'}</span>
      case 'next_action':   return <span className="text-gray-500 text-sm">{d.next_action ?? '-'}</span>
      case 'source':        return <span className="text-gray-500">{d.source ?? '-'}</span>
      case 'notes':         return <span className="text-gray-400 text-sm truncate max-w-[200px] block">{d.notes ?? '-'}</span>
      case 'service':       return <span className="text-gray-500">{d.service ?? '-'}</span>
      case 'company_name':  return <span className="font-medium">{d.company_name ?? '-'}</span>
      case 'contact_name':  return <span className="text-gray-500">{d.contact_name ?? '-'}</span>
      case 'industry':      return <span className="text-gray-500">{d.industry ?? '-'}</span>
      case 'latest_meeting_at': {
        const m = latestMeetings.get(d.id)
        if (!m?.action_date) return <span className="text-gray-300">—</span>
        return <span className="text-gray-600 text-sm">{m.action_date}</span>
      }
      case 'video_url': {
        if (!d.video_url) return <span className="text-gray-300">—</span>
        return <a href={d.video_url} target="_blank" rel="noreferrer" className="text-navy hover:underline text-sm">動画</a>
      }
      case 'minutes_text': {
        const text = d.minutes_text
        if (!text) return <span className="text-gray-300">—</span>
        return <span title={text} className="text-gray-500 text-sm">{text.slice(0, 28)}{text.length > 28 ? '…' : ''}</span>
      }
      default:              return <span className="text-gray-400">-</span>
    }
  }

  function renderEditCell(col: string) {
    switch (col) {
      case 'member':
      case 'member_id':       return memberSelect()
      case 'status':          return cellSelect('status', TOB_STATUSES)
      case 'priority':        return cellSelect('priority', PRIORITIES)
      case 'expected_amount': return cellInput('expected_amount', 'number')
      case 'win_probability': return cellInput('win_probability', 'number')
      case 'next_action_date': return cellInput('next_action_date', 'date')
      case 'source':          return cellSelect('source', sources.map(s => s.value))
      case 'service':         return cellSelect('service', services.map(s => s.value))
      case 'company_name':    return cellInput('company_name')
      case 'contact_name':    return cellInput('contact_name')
      case 'industry':        return cellSelect('industry', industries.map(i => i.value))
      case 'next_action':     return cellInput('next_action')
      case 'notes':           return cellInput('notes')
      default:                return null
    }
  }

  const activeDeals = tobDeals.filter(deal => {
    const d = deal as any
    if (search && !d.company_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterMember && d.member_id !== filterMember) return false
    if (filterStatus && d.status !== filterStatus) return false
    if (filterPriority && d.priority !== filterPriority) return false
    return true
  })
  const hasFilter = search || filterMember || filterStatus || filterPriority

  // 概要タブ用集計
  const wonDeals = useMemo(() => tobDeals.filter(d => d.status === '受注'), [tobDeals])
  const inProgressDeals = useMemo(() => tobDeals.filter(d => !['受注', '失注'].includes(d.status ?? '')), [tobDeals])
  const monthlyPaid = useMemo(() => tobDeals.filter(d => d.status === '受注' && (d.contract_amount ?? 0) > 0 && d.contract_start?.startsWith(selectedMonth)), [tobDeals, selectedMonth])
  const salesTotal = useMemo(() => monthlyPaid.reduce((s, d) => s + (d.contract_amount ?? 0), 0), [monthlyPaid])
  const paidTotal = useMemo(() => monthlyPaid.reduce((s, d) => s + (d.actual_amount ?? 0), 0), [monthlyPaid])
  const pipeline = useMemo(() => inProgressDeals.reduce((s, d) => s + (d.expected_amount ?? 0), 0), [inProgressDeals])
  const weightedPipeline = useMemo(() => inProgressDeals.reduce((s, d) => s + Math.round((d.expected_amount ?? 0) * (d.win_probability ?? 0) / 100), 0), [inProgressDeals])

  const statusBreakdown = useMemo(() => {
    const order = ['初回接触', 'ヒアリング', '提案中', '見積提出', 'クロージング', '受注', '失注', '保留', 'アポ取得', '商談中', '提案済', '交渉中', 'リード']
    return order.map(s => ({ status: s, count: tobDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)
  }, [tobDeals])

  const memberBreakdown = useMemo(() => {
    const map: Record<string, { name: string; pipeline: number; won: number; active: number }> = {}
    for (const d of tobDeals) {
      const name = (d as any).member?.name ?? '未割当'
      if (!map[name]) map[name] = { name, pipeline: 0, won: 0, active: 0 }
      if (!['受注', '失注'].includes(d.status ?? '')) {
        map[name].pipeline += d.expected_amount ?? 0
        map[name].active++
      }
      if (d.status === '受注') map[name].won++
    }
    return Object.values(map).sort((a, b) => b.pipeline - a.pipeline)
  }, [tobDeals])

  const serviceBreakdown = useMemo(() => {
    const map: Record<string, { won: number; pipeline: number }> = {}
    for (const d of tobDeals) {
      const key = d.service ?? 'その他'
      if (!map[key]) map[key] = { won: 0, pipeline: 0 }
      if (d.status === '受注') map[key].won++
      else if (!['失注'].includes(d.status ?? '')) map[key].pipeline += d.expected_amount ?? 0
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).filter(r => r.won > 0 || r.pipeline > 0).sort((a, b) => b.won - a.won)
  }, [tobDeals])

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <PageHeader
        title="法人案件"
        sub={`${tobDeals.length}件 / 受注 ${wonDeals.length}件 / 進行中 ${inProgressDeals.length}件`}
        right={
          <>
            <CSVImport tab="tob" members={members} sources={sources} onImported={fetchAll} />
            <StripeCSVImport tab="tob" members={members} onImported={fetchAll} />
            <AIImport members={members} onImported={fetchAll} />
            <button
              onClick={() => { setEditTarget(null); setShowForm(true) }}
              className="bg-navy text-white px-4 py-2 rounded-lg text-base font-medium hover:bg-[#152f5a] transition"
            >
              + 新規追加
            </button>
          </>
        }
      />

      {/* タブ */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'overview', label: '概要' },
          { key: 'kanban',   label: 'カンバン' },
          { key: 'deals',    label: '案件一覧' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-navy text-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 概要タブ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 月ナビゲーター */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedMonth(s => shiftMonth(s, -1))} className="px-2 py-1.5 text-sm font-bold text-[#8a96b0] hover:text-[#1a2540] rounded-lg transition">&lt;</button>
            <span className="text-sm font-bold text-[#1a2540] min-w-[72px] text-center">{selectedMonth.slice(0, 7)}</span>
            <button onClick={() => setSelectedMonth(s => shiftMonth(s, 1))} className="px-2 py-1.5 text-sm font-bold text-[#8a96b0] hover:text-[#1a2540] rounded-lg transition">&gt;</button>
          </div>
          {/* KPIカード */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button onClick={() => setKpiModal('sales')} className="text-left bg-white border border-[#e0e6f0] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#2a7a4a]/40 transition-all cursor-pointer" style={{ borderTop: '3px solid #2a7a4a' }}>
              <p className="text-xs text-[#8a96b0] font-bold uppercase tracking-widest mb-1">売上</p>
              <p className="text-2xl font-black text-[#1a2540] mt-1 font-mono">{salesTotal.toLocaleString()}<span className="text-sm font-normal text-[#aab0c8] ml-1">万円</span></p>
              <p className="text-xs text-[#aab0c8] mt-0.5">{monthlyPaid.filter(d => d.contract_amount).length}件</p>
            </button>
            <button onClick={() => setKpiModal('paid')} className="text-left bg-white border border-[#e0e6f0] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#1a6e6e]/40 transition-all cursor-pointer" style={{ borderTop: '3px solid #1a6e6e' }}>
              <p className="text-xs text-[#8a96b0] font-bold uppercase tracking-widest mb-1">着金額</p>
              <p className="text-2xl font-black text-[#1a2540] mt-1 font-mono">{paidTotal.toLocaleString()}<span className="text-sm font-normal text-[#aab0c8] ml-1">万円</span></p>
              <p className="text-xs text-[#aab0c8] mt-0.5">{monthlyPaid.filter(d => d.actual_amount).length}件</p>
            </button>
            <button onClick={() => setKpiModal('pipeline')} className="text-left bg-white border border-[#e0e6f0] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-navy/40 transition-all cursor-pointer" style={{ borderTop: '3px solid #1a3a6e' }}>
              <p className="text-xs text-[#8a96b0] font-bold uppercase tracking-widest mb-1">パイプライン</p>
              <p className="text-2xl font-black text-[#1a2540] mt-1 font-mono">{pipeline.toLocaleString()}<span className="text-sm font-normal text-[#aab0c8] ml-1">万円</span></p>
              <p className="text-xs text-[#aab0c8] mt-0.5">{inProgressDeals.length}件</p>
            </button>
            <button onClick={() => setKpiModal('weighted')} className="text-left bg-white border border-[#e0e6f0] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-[#b8902a]/40 transition-all cursor-pointer" style={{ borderTop: '3px solid #b8902a' }}>
              <p className="text-xs text-[#8a96b0] font-bold uppercase tracking-widest mb-1">加重パイプライン</p>
              <p className="text-2xl font-black text-navy mt-1 font-mono">{weightedPipeline.toLocaleString()}<span className="text-sm font-normal text-[#aab0c8] ml-1">万円</span></p>
              <p className="text-xs text-[#aab0c8] mt-0.5">{inProgressDeals.length}件</p>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ステータス別件数 */}
            <div className="bg-white border border-[#e0e6f0] rounded-xl p-5">
              <p className="text-xs font-bold text-[#8a96b0] uppercase tracking-widest mb-4">ステータス別件数</p>
              <div className="space-y-2">
                {statusBreakdown.map(({ status, count }) => {
                  const max = Math.max(...statusBreakdown.map(x => x.count))
                  const pct = Math.round(count / max * 100)
                  const color = status === '受注' ? 'bg-green-500'
                    : status === '失注' ? 'bg-red-400'
                    : ['クロージング', '見積提出'].includes(status) ? 'bg-navy'
                    : 'bg-gray-300'
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20 shrink-0">{status}</span>
                      <div className="flex-1 bg-gray-100 rounded h-2">
                        <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-gray-700 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 担当者別パイプライン */}
            <div className="bg-white border border-[#e0e6f0] rounded-xl p-5">
              <p className="text-xs font-bold text-[#8a96b0] uppercase tracking-widest mb-4">担当者別パイプライン</p>
              <div className="space-y-3">
                {memberBreakdown.map(m => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#e8eeff] flex items-center justify-center text-navy font-black text-xs">{m.name[0]}</div>
                      <span className="text-sm font-medium text-gray-700">{m.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold text-gray-800">{m.pipeline.toLocaleString()}<span className="text-xs text-gray-400 ml-0.5">万</span></p>
                      <p className="text-xs text-gray-400">受注{m.won}件 / 進行{m.active}件</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* サービス別 */}
            <div className="bg-white border border-[#e0e6f0] rounded-xl p-5">
              <p className="text-xs font-bold text-[#8a96b0] uppercase tracking-widest mb-4">サービス別</p>
              <div className="space-y-3">
                {serviceBreakdown.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{s.name}</span>
                    <div className="text-right">
                      <p className="text-xs font-bold text-green-600">受注 {s.won}件</p>
                      <p className="text-xs text-gray-400">パイプ {s.pipeline.toLocaleString()}万</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* カンバンタブ */}
      {activeTab === 'kanban' && (() => {
        const KANBAN_STAGES = ['リード', 'アポ取得', '商談中', '提案済', '交渉中', '見積提出']
        const today = new Date().toISOString().slice(0, 10)
        const stageColors: Record<string, string> = {
          'リード':    'bg-gray-100 text-gray-600',
          'アポ取得':  'bg-purple-100 text-purple-700',
          '商談中':    'bg-blue-100 text-blue-700',
          '提案済':    'bg-indigo-100 text-indigo-700',
          '交渉中':    'bg-amber-100 text-amber-700',
          '見積提出':  'bg-orange-100 text-orange-700',
        }
        return (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {KANBAN_STAGES.map(stage => {
                const cards = tobDeals.filter(d => d.status === stage)
                const total = cards.reduce((s, d) => s + (d.expected_amount ?? 0), 0)
                return (
                  <div key={stage} className="w-64 flex-shrink-0">
                    {/* カラムヘッダー */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${stageColors[stage]}`}>{stage}</span>
                        <span className="text-xs text-gray-400 font-bold">{cards.length}件</span>
                      </div>
                      <span className="text-xs font-mono text-gray-400">{total.toLocaleString()}万</span>
                    </div>
                    {/* カード一覧 */}
                    <div className="space-y-2">
                      {cards.length === 0 && (
                        <div className="h-16 rounded-xl border-2 border-dashed border-gray-100 flex items-center justify-center">
                          <span className="text-xs text-gray-300">案件なし</span>
                        </div>
                      )}
                      {cards.map(d => {
                        const mem = members.find(m => m.id === d.member_id)
                        const isOverdue = d.next_action_date && d.next_action_date < today
                        const isDueSoon = d.next_action_date && d.next_action_date >= today && d.next_action_date <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
                        return (
                          <div
                            key={d.id}
                            onClick={() => { setEditTarget(d); setShowForm(true) }}
                            className="bg-white rounded-xl border border-[#e0e6f0] p-3 shadow-sm hover:shadow-md hover:border-navy/30 transition-all cursor-pointer group"
                          >
                            {/* 優先度バー */}
                            {d.priority === '高' && <div className="h-0.5 w-full bg-red-400 rounded-full mb-2" />}
                            {d.priority === '中' && <div className="h-0.5 w-full bg-amber-300 rounded-full mb-2" />}

                            <p className="text-sm font-bold text-gray-800 leading-tight mb-2">{d.company_name}</p>

                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded bg-[#e8eeff] flex items-center justify-center text-navy font-black text-[10px]">
                                  {mem?.name.slice(0, 1) ?? '?'}
                                </div>
                                <span className="text-xs text-gray-400">{mem?.name ?? '-'}</span>
                              </div>
                              {d.expected_amount != null && (
                                <span className="text-xs font-mono font-bold text-gray-700">{d.expected_amount.toLocaleString()}万</span>
                              )}
                            </div>

                            {d.next_action_date && (
                              <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit ${
                                isOverdue ? 'bg-red-50 text-red-500' :
                                isDueSoon ? 'bg-amber-50 text-amber-600' :
                                'bg-gray-50 text-gray-400'
                              }`}>
                                {isOverdue ? '期限切れ' : isDueSoon ? '期限間近' : '期日'}
                                <span className="font-mono">{d.next_action_date}</span>
                              </div>
                            )}

                            {d.next_action && (
                              <p className="text-[10px] text-gray-400 mt-1.5 truncate">{d.next_action}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* 案件一覧タブ */}
      {activeTab === 'deals' && (
        <div className="space-y-4">
          {/* フィルターバー */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="企業名で検索..."
              className="border border-[#e0e6f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy w-44"
            />
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              className="border border-[#e0e6f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">担当者: 全員</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-[#e0e6f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">ステータス: 全て</option>
              {TOB_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="border border-[#e0e6f0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">優先度: 全て</option>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            {hasFilter && (
              <button
                onClick={() => { setSearch(''); setFilterMember(''); setFilterStatus(''); setFilterPriority('') }}
                className="text-sm text-gray-400 hover:text-gray-600 px-2 py-1.5 transition"
              >
                ✕ リセット
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">{activeDeals.length}件</span>
            {selectedIds.size > 0 && (
              <button
                onClick={bulkDelete}
                disabled={bulkDeleting}
                className="ml-2 px-3 py-1.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition disabled:opacity-50"
              >
                {bulkDeleting ? '削除中...' : `${selectedIds.size}件を削除`}
              </button>
            )}
          </div>

          <div className="bg-white border border-[#e0e6f0] rounded-xl overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-[#f8f9fd] border-b border-[#e0e6f0]">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={activeDeals.length > 0 && selectedIds.size === activeDeals.length}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  {tobCols.map(col => (
                    <th key={col.column_key} className={`text-left px-4 py-3 text-sm text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap ${TOB_COL_MIN_WIDTH[col.column_key] ?? ''}`}>
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {activeDeals.length === 0 ? (
                  <tr><td colSpan={tobCols.length + 2} className="text-center py-12 text-gray-400">案件がありません</td></tr>
                ) : activeDeals.map(deal => {
                  const editing = editingId === deal.id
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => { if (!editing) { setEditTarget(deal); setShowForm(true) } }}
                      className={`border-b border-[#e0e6f0] ${editing ? 'bg-[#f0f4ff]/40' : selectedIds.has(deal.id) ? 'bg-red-50' : 'hover:bg-[#f8f9fd] cursor-pointer'}`}
                    >
                      <td className="px-4 py-2 w-8" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(deal.id)}
                          onChange={() => toggleSelect(deal.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      {tobCols.map(col => (
                        <td key={col.column_key} className={`px-4 py-2 ${TOB_COL_MIN_WIDTH[col.column_key] ?? ''} ${TOB_COL_NOWRAP.has(col.column_key) ? '' : 'whitespace-nowrap'}`}>
                          {editing ? renderEditCell(col.column_key) : renderViewCell(col.column_key, deal)}
                        </td>
                      ))}
                      <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 justify-end whitespace-nowrap">
                          {editing ? (
                            <>
                              <button onClick={() => setShowConfirm(true)} className="text-sm text-white bg-navy hover:bg-[#152f5a] px-2 py-1 rounded transition">保存</button>
                              <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700">取消</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(deal)} className="text-sm text-navy hover:underline">編集</button>
                              <button onClick={() => deleteDeal(deal.id)} className="text-sm text-red-400 hover:underline">削除</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== KPI内訳モーダル ===== */}
      {kpiModal && (() => {
        type Row = { deal: DealToB; amount: number; label: string }
        const config: {
          title: string
          desc: string
          rows: Row[]
          total: number
          totalLabel: string
          amountHeader: string
        } = (() => {
          if (kpiModal === 'sales') {
            const rows = monthlyPaid.map(d => ({ deal: d, amount: d.contract_amount ?? 0, label: '' }))
            return {
              title: `売上　${selectedMonth}`,
              desc: `受注済み・着金あり（${selectedMonth}）の契約金額合計`,
              rows,
              total: salesTotal,
              totalLabel: '売上合計',
              amountHeader: '契約金額',
            }
          }
          if (kpiModal === 'paid') {
            const rows = monthlyPaid.map(d => ({ deal: d, amount: d.actual_amount ?? 0, label: '' }))
            return {
              title: `着金額　${selectedMonth}`,
              desc: `受注済み・着金日が ${selectedMonth} の実着金額合計`,
              rows,
              total: paidTotal,
              totalLabel: '着金合計',
              amountHeader: '着金額',
            }
          }
          if (kpiModal === 'pipeline') {
            const rows = inProgressDeals
              .filter(d => d.expected_amount != null)
              .sort((a, b) => (b.expected_amount ?? 0) - (a.expected_amount ?? 0))
              .map(d => ({ deal: d, amount: d.expected_amount ?? 0, label: '' }))
            return {
              title: 'パイプライン（進行中）',
              desc: '受注・失注以外のステータスにある案件の想定金額合計',
              rows,
              total: pipeline,
              totalLabel: 'パイプライン合計',
              amountHeader: '想定金額',
            }
          }
          if (kpiModal === 'weighted') {
            const rows = inProgressDeals
              .filter(d => d.expected_amount != null && d.win_probability != null)
              .sort((a, b) => {
                const wa = Math.round((b.expected_amount ?? 0) * (b.win_probability ?? 0) / 100)
                const wb = Math.round((a.expected_amount ?? 0) * (a.win_probability ?? 0) / 100)
                return wa - wb
              })
              .map(d => ({
                deal: d,
                amount: Math.round((d.expected_amount ?? 0) * (d.win_probability ?? 0) / 100),
                label: `${d.expected_amount?.toLocaleString()}万 × ${d.win_probability}%`,
              }))
            return {
              title: '加重パイプライン（進行中）',
              desc: '各案件の 想定金額 × 受注確率 の合計',
              rows,
              total: weightedPipeline,
              totalLabel: '加重合計',
              amountHeader: '加重金額',
            }
          }
          return { title: '', desc: '', rows: [], total: 0, totalLabel: '', amountHeader: '' }
        })()

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-[#1a2540]">{config.title}</h2>
                  <p className="text-xs text-[#8a96b0] mt-0.5">{config.desc}</p>
                </div>
                <button onClick={() => setKpiModal(null)} className="text-slate-400 hover:text-slate-600 ml-4 mt-0.5 flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {config.rows.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-10">対象案件がありません</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#f8f9fd] border-b border-[#e0e6f0]">
                      <tr>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#8a96b0]">企業名</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#8a96b0]">担当</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#8a96b0]">ステータス</th>
                        {kpiModal === 'weighted' && (
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#8a96b0]">計算式</th>
                        )}
                        {kpiModal === 'paid' && (
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#8a96b0]">着金日</th>
                        )}
                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-[#8a96b0]">{config.amountHeader}（万円）</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f8]">
                      {config.rows.map(({ deal: d, amount, label }) => {
                        const memberName = (d as any).member?.name ?? '-'
                        const sc = d.status === '受注' ? 'bg-green-100 text-green-700'
                          : d.status === '失注' ? 'bg-red-100 text-red-600'
                          : 'bg-[#e8eeff] text-navy'
                        return (
                          <tr
                            key={d.id}
                            className="hover:bg-[#f8f9fd] cursor-pointer transition-colors"
                            onClick={() => { setKpiModal(null); setEditTarget(d); setShowForm(true) }}
                          >
                            <td className="px-5 py-2.5 font-medium text-[#1a2540]">{d.company_name ?? '-'}</td>
                            <td className="px-4 py-2.5 text-[#6a7490]">{memberName}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sc}`}>{d.status ?? '-'}</span>
                            </td>
                            {kpiModal === 'weighted' && (
                              <td className="px-4 py-2.5 text-right text-xs text-[#8a96b0] font-mono">{label}</td>
                            )}
                            {kpiModal === 'paid' && (
                              <td className="px-4 py-2.5 text-right text-xs text-[#8a96b0] font-mono">{d.payment_date ?? '-'}</td>
                            )}
                            <td className="px-5 py-2.5 text-right font-mono font-bold text-[#1a2540]">
                              {amount > 0 ? amount.toLocaleString() : <span className="text-[#c0c8e0] font-normal">-</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-6 py-3 border-t border-[#e0e6f0] flex items-center justify-between bg-[#f8f9fd] rounded-b-2xl">
                <span className="text-xs text-[#8a96b0]">{config.rows.length}件</span>
                <span className="text-sm font-bold text-[#1a2540]">
                  {config.totalLabel}：
                  <span className="font-mono ml-1">{config.total.toLocaleString()}万円</span>
                </span>
              </div>
            </div>
          </div>
        )
      })()}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl p-8 w-80 text-center">
            <p className="font-bold text-gray-800 text-lg mb-1">変更を保存しますか？</p>
            <p className="text-sm text-gray-400 mb-6">この操作はすぐにデータベースに反映されます</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2 text-base text-gray-500 border border-gray-200 rounded-sm hover:bg-gray-50 transition">
                キャンセル
              </button>
              <button onClick={confirmSave} disabled={saving} className="flex-1 px-4 py-2 text-base text-white bg-navy rounded-lg hover:bg-[#152f5a] disabled:opacity-50 transition">
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <DealToBForm members={members} initial={editTarget} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchAll() }} />
      )}
    </div>
  )
}
