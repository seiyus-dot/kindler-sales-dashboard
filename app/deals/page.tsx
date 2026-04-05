'use client'

import { useEffect, useState } from 'react'
import { supabase, DealToB, DealToC, Member, MasterOption, ColumnConfig } from '@/lib/supabase'
import DealToBForm from '@/components/DealToBForm'
import DealToCForm from '@/components/DealToCForm'
import CSVImport from '@/components/CSVImport'
import StripeCSVImport from '@/components/StripeCSVImport'
import AICampApplicationImport from '@/components/AICampApplicationImport'

type Tab = 'tob' | 'toc'

const TOB_STATUSES = ['アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'リード', '受注', '失注', '保留']
const TOC_STATUSES = ['相談予約', 'ヒアリング', '提案中', 'クロージング', '相談済', '受注', '失注', '保留']
const PRIORITIES = ['高', '中', '低']

export default function DealsPage() {
  const [tab, setTab] = useState<Tab>('tob')
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [tocDeals, setTocDeals] = useState<DealToC[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [tobCols, setTobCols] = useState<ColumnConfig[]>([])
  const [tocCols, setTocCols] = useState<ColumnConfig[]>([])
  const [sources, setSources] = useState<MasterOption[]>([])
  const [services, setServices] = useState<MasterOption[]>([])
  const [industries, setIndustries] = useState<MasterOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<DealToB | DealToC | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterMember, setFilterMember] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [tobRes, tocRes, membersRes, colRes, srcRes, svcRes, indRes] = await Promise.all([
      supabase.from('deals_tob').select('*, member:members!member_id(name), sub_member:members!sub_member_id(name)').order('created_at', { ascending: false }),
      supabase.from('deals_toc').select('*, member:members!member_id(name), sub_member:members!sub_member_id(name)').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('column_config').select('*').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'source').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'service').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'industry').order('sort_order'),
    ])
    if (tobRes.data) setTobDeals(tobRes.data)
    if (tocRes.data) setTocDeals(tocRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    if (colRes.data) {
      setTobCols(colRes.data.filter((c: ColumnConfig) => c.table_type === 'tob' && c.visible))
      setTocCols(colRes.data.filter((c: ColumnConfig) => c.table_type === 'toc' && c.visible))
    }
    if (srcRes.data) setSources(srcRes.data)
    if (svcRes.data) setServices(svcRes.data)
    if (indRes.data) setIndustries(indRes.data)
  }

  function startEdit(deal: DealToB | DealToC, type: Tab) {
    setEditingId(deal.id)
    if (type === 'tob') {
      const d = deal as DealToB
      setDraft({
        member_id: d.member_id ?? '',
        company_name: d.company_name ?? '',
        contact_name: d.contact_name ?? '',
        industry: d.industry ?? '',
        status: d.status ?? '',
        priority: d.priority ?? '',
        expected_amount: d.expected_amount?.toString() ?? '',
        win_probability: d.win_probability?.toString() ?? '',
        source: d.source ?? '',
        service: d.service ?? '',
        next_action: d.next_action ?? '',
        next_action_date: d.next_action_date ?? '',
        notes: d.notes ?? '',
      })
    } else {
      const d = deal as DealToC
      setDraft({
        member_id: d.member_id ?? '',
        name: d.name ?? '',
        contact: d.contact ?? '',
        source: d.source ?? '',
        service: d.service ?? '',
        status: d.status ?? '',
        priority: d.priority ?? '',
        expected_amount: d.expected_amount?.toString() ?? '',
        win_probability: d.win_probability?.toString() ?? '',
        next_action: d.next_action ?? '',
        next_action_date: d.next_action_date ?? '',
        notes: d.notes ?? '',
      })
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({})
    setShowConfirm(false)
  }

  async function confirmSave() {
    if (!editingId) return
    setSaving(true)
    const table = tab === 'tob' ? 'deals_tob' : 'deals_toc'
    const payload: Record<string, string | number | null> = {}
    Object.entries(draft).forEach(([k, v]) => {
      if (['expected_amount', 'win_probability'].includes(k)) {
        payload[k] = v ? parseInt(v) : null
      } else {
        payload[k] = v || null
      }
    })
    await supabase.from(table).update(payload).eq('id', editingId)
    setSaving(false)
    setShowConfirm(false)
    setEditingId(null)
    setDraft({})
    fetchAll()
  }

  async function deleteDeal(id: string, type: Tab) {
    if (!confirm('削除しますか？')) return
    const table = type === 'tob' ? 'deals_tob' : 'deals_toc'
    await supabase.from(table).delete().eq('id', id)
    fetchAll()
  }

  const set = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }))

  const statusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-500'
    if (status === '受注') return 'bg-green-100 text-green-700'
    if (status === '失注') return 'bg-red-100 text-red-600'
    if (['交渉中', '提案済'].includes(status)) return 'bg-blue-100 text-blue-700'
    if (['商談中', 'アポ取得'].includes(status)) return 'bg-purple-100 text-purple-700'
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
      className="w-full border border-blue-300 rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
    />
  )

  const cellSelect = (k: string, options: string[]) => (
    <select
      value={draft[k] ?? ''}
      onChange={e => set(k, e.target.value)}
      className="w-full border border-blue-300 rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
    >
      <option value="">-</option>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  const memberSelect = () => (
    <select
      value={draft.member_id ?? ''}
      onChange={e => set('member_id', e.target.value)}
      className="w-full border border-blue-300 rounded px-2 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
    >
      <option value="">-</option>
      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderViewCell(col: string, deal: DealToB | DealToC) {
    const d = deal as any
    switch (col) {
      case 'member':        return <span className="font-medium">{d.member?.name ?? '-'}</span>
      case 'sub_member':    return <span className="text-gray-500">{d.sub_member?.name ?? '-'}</span>
      case 'status':        return <span className={`px-2 py-0.5 rounded text-sm font-medium ${statusColor(d.status)}`}>{d.status ?? '-'}</span>
      case 'priority':      return <span className={priorityColor(d.priority)}>{d.priority ?? '-'}</span>
      case 'expected_amount': return <span className="text-right block font-mono">{d.expected_amount?.toLocaleString() ?? '-'}</span>
      case 'weighted_amount': {
        const amt = d.expected_amount ?? null
        const prob = d.win_probability ?? null
        if (amt === null || prob === null) return <span className="text-gray-300">-</span>
        const val = Math.round(amt * prob / 100)
        return <span className="text-right block font-mono text-blue-600 font-medium">{val.toLocaleString()}</span>
      }
      case 'win_probability': {
        const pct = d.win_probability ?? null
        if (pct === null) return <span className="text-gray-300">-</span>
        const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-gray-300'
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
      case 'name':          return <span className="font-medium">{d.name ?? '-'}</span>
      case 'contact':       return <span className="text-gray-500">{d.contact ?? '-'}</span>
      case 'service':       return <span className="text-gray-500">{d.service ?? '-'}</span>
      default:              return <span className="text-gray-400">-</span>
    }
  }

  function renderEditCell(col: string) {
    switch (col) {
      case 'member':          return memberSelect()
      case 'status':          return cellSelect('status', tab === 'tob' ? TOB_STATUSES : TOC_STATUSES)
      case 'priority':        return cellSelect('priority', PRIORITIES)
      case 'expected_amount': return cellInput('expected_amount', 'number')
      case 'win_probability': return cellInput('win_probability', 'number')
      case 'next_action_date': return cellInput('next_action_date', 'date')
      case 'source':          return cellSelect('source', sources.map(s => s.value))
      case 'service':         return cellSelect('service', services.map(s => s.value))
      case 'service':         return cellSelect('service', services.map(s => s.value))
      case 'company_name':    return cellInput('company_name')
      case 'name':            return cellInput('name')
      case 'contact_name':    return cellInput('contact_name')
      case 'industry':        return cellSelect('industry', industries.map(i => i.value))
      case 'contact':         return cellInput('contact')
      case 'next_action':     return cellInput('next_action')
      case 'notes':           return cellInput('notes')
      default:                return null
    }
  }

  const activeCols = tab === 'tob' ? tobCols : tocCols
  const baseDeals = tab === 'tob' ? tobDeals : tocDeals
  const activeDeals = baseDeals.filter(deal => {
    const d = deal as any
    const label = tab === 'tob' ? d.company_name : d.name
    if (search && !label?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterMember && d.member_id !== filterMember) return false
    if (filterStatus && d.status !== filterStatus) return false
    if (filterPriority && d.priority !== filterPriority) return false
    return true
  })
  const hasFilter = search || filterMember || filterStatus || filterPriority

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-sm">
          <button
            onClick={() => { setTab('tob'); cancelEdit() }}
            className={`px-5 py-2 rounded-md text-base font-medium transition-all ${tab === 'tob' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            法人案件 ({tobDeals.length})
          </button>
          <button
            onClick={() => { setTab('toc'); cancelEdit() }}
            className={`px-5 py-2 rounded-md text-base font-medium transition-all ${tab === 'toc' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            個人案件 ({tocDeals.length})
          </button>
        </div>
        <div className="flex gap-2">
          <CSVImport tab={tab} members={members} sources={sources} onImported={fetchAll} />
          <StripeCSVImport tab={tab} members={members} onImported={fetchAll} />
          {tab === 'toc' && <AICampApplicationImport members={members} onImported={fetchAll} />}
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-sm text-base font-medium hover:bg-blue-700 transition"
          >
            + 新規追加
          </button>
        </div>
      </div>

      {/* フィルターバー */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'tob' ? '企業名で検索...' : '氏名で検索...'}
          className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
        />
        <select
          value={filterMember}
          onChange={e => setFilterMember(e.target.value)}
          className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">担当者: 全員</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">ステータス: 全て</option>
          {(tab === 'tob' ? TOB_STATUSES : TOC_STATUSES).map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {activeCols.map(col => (
                <th key={col.column_key} className="text-left px-4 py-3 text-sm text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {activeDeals.length === 0 ? (
              <tr><td colSpan={activeCols.length + 1} className="text-center py-12 text-gray-400">案件がありません</td></tr>
            ) : activeDeals.map(deal => {
              const editing = editingId === deal.id
              return (
                <tr key={deal.id} className={`border-b border-gray-100 ${editing ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                  {activeCols.map(col => (
                    <td key={col.column_key} className="px-4 py-2">
                      {editing ? renderEditCell(col.column_key) : renderViewCell(col.column_key, deal)}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <div className="flex gap-2 justify-end whitespace-nowrap">
                      {editing ? (
                        <>
                          <button onClick={() => setShowConfirm(true)} className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition">保存</button>
                          <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700">取消</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(deal, tab)} className="text-sm text-blue-500 hover:underline">編集</button>
                          <button onClick={() => { setEditTarget(deal); setShowForm(true) }} className="text-sm text-gray-400 hover:underline">詳細</button>
                          <button onClick={() => deleteDeal(deal.id, tab)} className="text-sm text-red-400 hover:underline">削除</button>
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

      {showConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl p-8 w-80 text-center">
            <p className="font-bold text-gray-800 text-lg mb-1">変更を保存しますか？</p>
            <p className="text-sm text-gray-400 mb-6">この操作はすぐにデータベースに反映されます</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2 text-base text-gray-500 border border-gray-200 rounded-sm hover:bg-gray-50 transition">
                キャンセル
              </button>
              <button onClick={confirmSave} disabled={saving} className="flex-1 px-4 py-2 text-base text-white bg-blue-600 rounded-sm hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && tab === 'tob' && (
        <DealToBForm members={members} initial={editTarget as DealToB | null} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchAll() }} />
      )}
      {showForm && tab === 'toc' && (
        <DealToCForm members={members} initial={editTarget as DealToC | null} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchAll() }} />
      )}
    </div>
  )
}
