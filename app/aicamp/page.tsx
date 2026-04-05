'use client'

import { useEffect, useState } from 'react'
import { supabase, AICampConsultation, AICampMonthlyGoal, AICampAdWeekly, Member, CONSULTATION_STATUSES } from '@/lib/supabase'
import AICampConsultationForm from '@/components/AICampConsultationForm'
import AIImport from '@/components/AIImport'
import SourceMasterModal from '@/components/SourceMasterModal'

const STATUS_COLORS: Record<string, string> = {
  '成約':     'bg-green-100 text-green-700',
  '失注':     'bg-red-100 text-red-600',
  '保留':     'bg-amber-100 text-amber-700',
  'ドタキャン': 'bg-red-50 text-red-400',
  'キャンセル': 'bg-gray-100 text-gray-500',
  '予定':     'bg-blue-100 text-blue-600',
}

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AICampPage() {
  const today = new Date()
  const [month, setMonth] = useState(toMonthStr(today))
  const [consultations, setConsultations] = useState<AICampConsultation[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [goal, setGoal] = useState<AICampMonthlyGoal | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AICampConsultation | null>(null)
  const [filterMember, setFilterMember] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showSourceMaster, setShowSourceMaster] = useState(false)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineDraft, setInlineDraft] = useState<Record<string, string>>({})
  const [inlineSaving, setInlineSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [adWeekly, setAdWeekly] = useState<AICampAdWeekly[]>([])
  const [adEditId, setAdEditId] = useState<string | null>(null)
  const [adDraft, setAdDraft] = useState<Record<string, string>>({})
  const [adSaving, setAdSaving] = useState(false)
  const [showAddWeek, setShowAddWeek] = useState(false)
  const [newWeek, setNewWeek] = useState({ week_label: '', ad_spend: '', list_count: '', consultation_count: '', seated_count: '' })

  useEffect(() => { fetchAll() }, [month])

  async function fetchAll() {
    setLoading(true)
    const [consRes, membersRes, goalRes, adRes] = await Promise.all([
      supabase
        .from('aicamp_consultations')
        .select('*, member:members(name)')
        .or(`and(consultation_date.gte.${month}-01,consultation_date.lt.${nextMonth(month)}),and(payment_date.gte.${month}-01,payment_date.lt.${nextMonth(month)})`)
        .order('consultation_date', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('aicamp_monthly_goals').select('*').eq('month', month).maybeSingle(),
      supabase.from('aicamp_ad_weekly').select('*').eq('month', month).order('sort_order').order('created_at'),
    ])
    if (consRes.data) setConsultations(consRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    setGoal(goalRes.data ?? null)
    setGoalInput(goalRes.data?.contract_goal?.toString() ?? '50')
    setAdWeekly(adRes.data ?? [])
    setLoading(false)
  }

  function nextMonth(m: string) {
    const [y, mo] = m.split('-').map(Number)
    return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
  }

  async function saveGoal() {
    const val = parseInt(goalInput)
    if (isNaN(val)) return
    if (goal) {
      await supabase.from('aicamp_monthly_goals').update({ contract_goal: val }).eq('id', goal.id)
    } else {
      await supabase.from('aicamp_monthly_goals').insert({ month, contract_goal: val })
    }
    setEditingGoal(false)
    fetchAll()
  }

  function startAdEdit(row: AICampAdWeekly) {
    setAdEditId(row.id)
    setAdDraft({
      week_label: row.week_label,
      ad_spend: row.ad_spend.toString(),
      list_count: row.list_count.toString(),
      consultation_count: row.consultation_count?.toString() ?? '',
      seated_count: row.seated_count?.toString() ?? '',
    })
  }

  async function saveAdRow() {
    if (!adEditId) return
    setAdSaving(true)
    await supabase.from('aicamp_ad_weekly').update({
      week_label: adDraft.week_label,
      ad_spend: parseInt(adDraft.ad_spend) || 0,
      list_count: parseInt(adDraft.list_count) || 0,
      consultation_count: adDraft.consultation_count ? parseInt(adDraft.consultation_count) : null,
      seated_count: adDraft.seated_count ? parseInt(adDraft.seated_count) : null,
    }).eq('id', adEditId)
    setAdSaving(false)
    setAdEditId(null)
    fetchAll()
  }

  async function addWeekRow() {
    if (!newWeek.week_label.trim()) return
    setAdSaving(true)
    await supabase.from('aicamp_ad_weekly').insert({
      month,
      week_label: newWeek.week_label.trim(),
      ad_spend: parseInt(newWeek.ad_spend) || 0,
      list_count: parseInt(newWeek.list_count) || 0,
      consultation_count: newWeek.consultation_count ? parseInt(newWeek.consultation_count) : null,
      seated_count: newWeek.seated_count ? parseInt(newWeek.seated_count) : null,
      sort_order: adWeekly.length,
    })
    setAdSaving(false)
    setShowAddWeek(false)
    setNewWeek({ week_label: '', ad_spend: '', list_count: '', consultation_count: '', seated_count: '' })
    fetchAll()
  }

  async function deleteAdRow(id: string) {
    if (!confirm('この週のデータを削除しますか？')) return
    await supabase.from('aicamp_ad_weekly').delete().eq('id', id)
    fetchAll()
  }

  function startInlineEdit(c: AICampConsultation) {
    setInlineEditId(c.id)
    setInlineDraft({
      consultation_date: c.consultation_date?.slice(0, 16) ?? '',
      member_id: c.member_id ?? '',
      name: c.name ?? '',
      line_name: c.line_name ?? '',
      source: c.source ?? '',
      status: c.status ?? '予定',
      payment_amount: c.payment_amount?.toString() ?? '',
      reply_deadline: c.reply_deadline ?? '',
    })
  }

  async function saveInlineEdit(id: string) {
    setInlineSaving(true)
    const payload = {
      consultation_date: inlineDraft.consultation_date || null,
      member_id: inlineDraft.member_id || null,
      name: inlineDraft.name || null,
      source: inlineDraft.source || null,
      status: inlineDraft.status,
      payment_amount: inlineDraft.payment_amount ? parseInt(inlineDraft.payment_amount) : null,
      reply_deadline: inlineDraft.reply_deadline || null,
    }
    await supabase.from('aicamp_consultations').update(payload).eq('id', id)
    setInlineSaving(false)
    setInlineEditId(null)
    fetchAll()
  }

  function cancelInlineEdit() {
    setInlineEditId(null)
    setInlineDraft({})
  }

  const setDraft = (k: string, v: string) => setInlineDraft(d => ({ ...d, [k]: v }))

  async function deleteConsultation(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('aicamp_consultations').delete().eq('id', id)
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
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)))
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return
    setBulkDeleting(true)
    await supabase.from('aicamp_consultations').delete().in('id', Array.from(selectedIds))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    fetchAll()
  }

  const contractGoal = goal?.contract_goal ?? 50
  const filtered = consultations.filter(c => {
    if (filterMember && c.member_id !== filterMember) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  })

  // KPI集計（月全体）
  const contracted = consultations.filter(c => c.status === '成約')
  const held = consultations.filter(c => c.status === '保留')
  const conducted = consultations.filter(c => ['成約', '失注', '保留'].includes(c.status ?? ''))
  const cancelled = consultations.filter(c => ['ドタキャン', 'キャンセル'].includes(c.status ?? ''))
  const totalScheduled = conducted.length + cancelled.length
  const cancelRate = totalScheduled > 0 ? Math.round(cancelled.length / totalScheduled * 100) : 0
  const contractRate = conducted.length > 0 ? Math.round(contracted.length / conducted.length * 100) : 0
  const totalRevenue = contracted.reduce((s, c) => s + (c.payment_amount ?? 0), 0)
  const progressPct = Math.min(Math.round(contracted.length / contractGoal * 100), 100)

  // 担当者別KPI
  const memberStats = members.map(m => {
    const mc = consultations.filter(c => c.member_id === m.id)
    const mContracted = mc.filter(c => c.status === '成約')
    const mConducted = mc.filter(c => ['成約', '失注', '保留'].includes(c.status ?? ''))
    const mCancelled = mc.filter(c => ['ドタキャン', 'キャンセル'].includes(c.status ?? ''))
    const mTotal = mConducted.length + mCancelled.length
    return {
      member: m,
      contracted: mContracted.length,
      held: mc.filter(c => c.status === '保留').length,
      conducted: mConducted.length,
      cancelled: mCancelled.length,
      cancelRate: mTotal > 0 ? Math.round(mCancelled.length / mTotal * 100) : 0,
      contractRate: mConducted.length > 0 ? Math.round(mContracted.length / mConducted.length * 100) : 0,
      revenue: mContracted.reduce((s, c) => s + (c.payment_amount ?? 0), 0),
    }
  }).filter(s => s.conducted + s.cancelled + s.contracted > 0 || consultations.some(c => c.member_id === s.member.id))

  const monthLabel = `${month.split('-')[0]}年${parseInt(month.split('-')[1])}月`

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">AI CAMP</h1>
          <p className="text-sm text-gray-400 mt-0.5">ロードマップ作成会 商談管理</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => setShowSourceMaster(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-sm hover:bg-gray-50 transition"
          >
            流入経路マスタ
          </button>
          <AIImport members={members} onImported={fetchAll} />
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
          >
            + 商談追加
          </button>
        </div>
      </div>

      {/* 目標進捗 */}
      <div className="bg-white border border-gray-200 rounded p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-500">{monthLabel} 成約目標</span>
            {editingGoal ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  className="w-20 border border-blue-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button onClick={saveGoal} className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition">保存</button>
                <button onClick={() => setEditingGoal(false)} className="text-sm text-gray-400 hover:text-gray-600">取消</button>
              </div>
            ) : (
              <button onClick={() => setEditingGoal(true)} className="text-sm text-blue-500 hover:underline">
                目標 {contractGoal}件 を変更
              </button>
            )}
          </div>
          <span className="text-2xl font-black font-mono text-gray-900">
            {contracted.length} <span className="text-base font-bold text-gray-400">/ {contractGoal}件</span>
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${progressPct >= 100 ? 'bg-green-500' : progressPct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {progressPct}% 達成 — あと {Math.max(contractGoal - contracted.length, 0)}件で目標達成
        </p>
      </div>

      {/* サマリーKPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '成約数', value: contracted.length, unit: '件', color: 'text-green-600' },
          { label: '実商談数', value: conducted.length, unit: '件', color: 'text-gray-800' },
          { label: 'キャンセル率', value: cancelRate, unit: '%', color: cancelRate > 20 ? 'text-red-500' : 'text-gray-800' },
          { label: '成約率', value: contractRate, unit: '%', color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded p-4">
            <p className="text-xs text-gray-400 font-bold mb-1">{k.label}</p>
            <p className={`text-2xl font-black font-mono ${k.color}`}>
              {k.value}<span className="text-sm font-bold text-gray-400 ml-0.5">{k.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 広告数値 */}
      {(() => {
        const totalAdSpend = adWeekly.reduce((s, r) => s + r.ad_spend, 0)
        const totalListCount = adWeekly.reduce((s, r) => s + r.list_count, 0)
        const totalConsultation = adWeekly.reduce((s, r) => s + (r.consultation_count ?? 0), 0)
        const totalSeated = adWeekly.reduce((s, r) => s + (r.seated_count ?? 0), 0)
        const cpa = totalListCount > 0 ? Math.round(totalAdSpend / totalListCount) : null
        const meetingCpa = totalConsultation > 0 ? Math.round(totalAdSpend / totalConsultation) : null
        const seatedCpa = totalSeated > 0 ? Math.round(totalAdSpend / totalSeated) : null
        const cpo = contracted.length > 0 ? Math.round(totalAdSpend / contracted.length) : null
        const roas = totalAdSpend > 0 ? Math.round(totalRevenue / totalAdSpend * 100) : null

        const adCols = ['期間', '広告費[円]', 'リスト数[人]', '面談申込数[人]', '着座数[人]', '']

        return (
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">広告数値（{monthLabel}）</h2>
              <button
                onClick={() => setShowAddWeek(true)}
                className="text-xs text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition"
              >
                + 週を追加
              </button>
            </div>

            {/* 週別テーブル */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {adCols.map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adWeekly.length === 0 && !showAddWeek ? (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-xs">「週を追加」から入力してください</td></tr>
                  ) : adWeekly.map(row => {
                    const editing = adEditId === row.id
                    return (
                      <tr key={row.id} className={`border-b border-gray-50 ${editing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        {editing ? (
                          <>
                            <td className="px-4 py-2"><input value={adDraft.week_label} onChange={e => setAdDraft(d => ({ ...d, week_label: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs w-28 focus:outline-none" placeholder="4/1〜4/5" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.ad_spend} onChange={e => setAdDraft(d => ({ ...d, ad_spend: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-28 focus:outline-none" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.list_count} onChange={e => setAdDraft(d => ({ ...d, list_count: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.consultation_count} onChange={e => setAdDraft(d => ({ ...d, consultation_count: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" /></td>
                            <td className="px-4 py-2"><input type="number" value={adDraft.seated_count} onChange={e => setAdDraft(d => ({ ...d, seated_count: e.target.value }))} className="border border-blue-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" /></td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 justify-end">
                                <button onClick={saveAdRow} disabled={adSaving} className="text-xs text-white bg-blue-600 px-2 py-1 rounded disabled:opacity-50">{adSaving ? '...' : '保存'}</button>
                                <button onClick={() => setAdEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 font-medium text-gray-700">{row.week_label}</td>
                            <td className="px-4 py-2.5 font-mono text-gray-700">¥{row.ad_spend.toLocaleString()}</td>
                            <td className="px-4 py-2.5 font-mono text-gray-700">{row.list_count}</td>
                            <td className="px-4 py-2.5 font-mono text-gray-500">{row.consultation_count ?? '-'}</td>
                            <td className="px-4 py-2.5 font-mono text-gray-500">{row.seated_count ?? '-'}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => startAdEdit(row)} className="text-xs text-blue-500 hover:underline">編集</button>
                                <button onClick={() => deleteAdRow(row.id)} className="text-xs text-red-400 hover:underline">削除</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}

                  {/* 追加行 */}
                  {showAddWeek && (
                    <tr className="border-b border-gray-50 bg-green-50">
                      <td className="px-4 py-2"><input value={newWeek.week_label} onChange={e => setNewWeek(w => ({ ...w, week_label: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs w-28 focus:outline-none" placeholder="4/1〜4/5" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.ad_spend} onChange={e => setNewWeek(w => ({ ...w, ad_spend: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-28 focus:outline-none" placeholder="0" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.list_count} onChange={e => setNewWeek(w => ({ ...w, list_count: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" placeholder="0" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.consultation_count} onChange={e => setNewWeek(w => ({ ...w, consultation_count: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" placeholder="-" /></td>
                      <td className="px-4 py-2"><input type="number" value={newWeek.seated_count} onChange={e => setNewWeek(w => ({ ...w, seated_count: e.target.value }))} className="border border-green-300 rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none" placeholder="-" /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 justify-end">
                          <button onClick={addWeekRow} disabled={adSaving} className="text-xs text-white bg-green-600 px-2 py-1 rounded disabled:opacity-50">{adSaving ? '...' : '追加'}</button>
                          <button onClick={() => setShowAddWeek(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* 合計行 */}
                  {adWeekly.length > 0 && (
                    <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                      <td className="px-4 py-2.5 text-gray-500 text-xs">合計</td>
                      <td className="px-4 py-2.5 font-mono text-gray-800">¥{totalAdSpend.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-800">{totalListCount}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-800">{totalConsultation > 0 ? totalConsultation : '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-800">{totalSeated > 0 ? totalSeated : '-'}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* KPI */}
            {adWeekly.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'CPA', value: cpa ? `¥${cpa.toLocaleString()}` : '-', sub: '広告費÷リスト数' },
                  { label: '面談申込CPA', value: meetingCpa ? `¥${meetingCpa.toLocaleString()}` : '-', sub: '広告費÷面談申込数' },
                  { label: '着座単価', value: seatedCpa ? `¥${seatedCpa.toLocaleString()}` : '-', sub: '広告費÷着座数' },
                  { label: 'CPO', value: cpo ? `¥${cpo.toLocaleString()}` : '-', sub: `広告費÷成約${contracted.length}件` },
                  { label: 'ROAS', value: roas !== null ? `${roas}%` : '-', sub: `売上÷広告費`, color: roas !== null ? (roas >= 100 ? 'text-green-600' : roas >= 60 ? 'text-amber-500' : 'text-red-500') : 'text-gray-300' },
                ].map(k => (
                  <div key={k.label}>
                    <p className="text-xs text-gray-400 font-bold mb-0.5">{k.label}</p>
                    <p className={`text-xl font-black font-mono ${k.color ?? 'text-gray-800'}`}>{k.value}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* 担当者別KPI */}
      {memberStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">担当者別KPI</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['担当者', '成約', '保留', '実商談', 'キャンセル', 'キャンセル率', '成約率', '売上'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberStats.map(s => (
                <tr key={s.member.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{s.member.name}</td>
                  <td className="px-4 py-2.5 font-bold text-green-600">{s.contracted}</td>
                  <td className="px-4 py-2.5 text-amber-600">{s.held}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.conducted}</td>
                  <td className="px-4 py-2.5 text-red-400">{s.cancelled}</td>
                  <td className="px-4 py-2.5">
                    <span className={s.cancelRate > 20 ? 'text-red-500 font-bold' : 'text-gray-600'}>{s.cancelRate}%</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={s.contractRate >= 50 ? 'text-green-600 font-bold' : 'text-gray-600'}>{s.contractRate}%</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">
                    {s.revenue > 0 ? `¥${s.revenue.toLocaleString()}` : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                <td className="px-4 py-2.5 text-gray-500">合計</td>
                <td className="px-4 py-2.5 text-green-600">{contracted.length}</td>
                <td className="px-4 py-2.5 text-amber-600">{held.length}</td>
                <td className="px-4 py-2.5 text-gray-600">{conducted.length}</td>
                <td className="px-4 py-2.5 text-red-400">{cancelled.length}</td>
                <td className="px-4 py-2.5 text-gray-600">{cancelRate}%</td>
                <td className="px-4 py-2.5 text-gray-600">{contractRate}%</td>
                <td className="px-4 py-2.5 font-mono text-gray-700">
                  {totalRevenue > 0 ? `¥${totalRevenue.toLocaleString()}` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 商談一覧 */}
      <div className="bg-white border border-gray-200 rounded">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-700">商談一覧 ({filtered.length}件)</h2>
            {selectedIds.size > 0 && (
              <button
                onClick={bulkDelete}
                disabled={bulkDeleting}
                className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1 rounded transition"
              >
                {bulkDeleting ? '削除中...' : `${selectedIds.size}件を削除`}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
              <option value="">担当者: 全員</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
              <option value="">ステータス: 全て</option>
              {['予定', '成約', '失注', '保留', 'ドタキャン', 'キャンセル'].map(s => <option key={s}>{s}</option>)}
            </select>
            {(filterMember || filterStatus) && (
              <button onClick={() => { setFilterMember(''); setFilterStatus('') }} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                {['実施日時', '担当者', '氏名', '流入経路', 'ステータス', '着金額', '返事期限', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">商談がありません</td></tr>
              ) : filtered.map(c => {
                const isEditing = inlineEditId === c.id
                return (
                  <tr key={c.id} className={`border-b border-gray-50 ${isEditing ? 'bg-blue-50' : selectedIds.has(c.id) ? 'bg-red-50' : 'hover:bg-gray-50 cursor-pointer'}`}
                    onClick={!isEditing ? () => startInlineEdit(c) : undefined}
                  >
                    <td className="px-4 py-2.5 w-8" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          type="datetime-local"
                          value={inlineDraft.consultation_date}
                          onChange={e => setDraft('consultation_date', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-40"
                        />
                      ) : (
                        <span className="text-gray-600 text-xs">
                          {c.consultation_date ? new Date(c.consultation_date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <select
                          value={inlineDraft.member_id}
                          onChange={e => setDraft('member_id', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="">未割当</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-gray-700">{(c.member as any)?.name ?? '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          value={inlineDraft.name}
                          onChange={e => setDraft('name', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
                          placeholder="氏名"
                        />
                      ) : (
                        <>
                          <div className="font-medium text-gray-800">{c.name ?? c.line_name ?? '-'}</div>
                          {c.occupation && <div className="text-xs text-gray-400">{c.occupation}</div>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px]" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          value={inlineDraft.source}
                          onChange={e => setDraft('source', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                          placeholder="流入経路"
                        />
                      ) : (
                        <span className="text-xs text-gray-500 line-clamp-2">{c.source ?? '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <select
                          value={inlineDraft.status}
                          onChange={e => setDraft('status', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {CONSULTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status ?? '予定'] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.status ?? '予定'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={inlineDraft.payment_amount}
                          onChange={e => setDraft('payment_amount', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
                          placeholder="円"
                        />
                      ) : (
                        <span className="font-mono text-gray-700">
                          {c.payment_amount ? `¥${c.payment_amount.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          type="date"
                          value={inlineDraft.reply_deadline}
                          onChange={e => setDraft('reply_deadline', e.target.value)}
                          className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      ) : (
                        <span className="text-xs text-gray-500">{c.reply_deadline ?? '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveInlineEdit(c.id)}
                              disabled={inlineSaving}
                              className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 transition"
                            >
                              {inlineSaving ? '...' : '保存'}
                            </button>
                            <button onClick={cancelInlineEdit} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditTarget(c); setShowForm(true) }} className="text-xs text-blue-500 hover:underline">詳細編集</button>
                            <button onClick={() => deleteConsultation(c.id)} className="text-xs text-red-400 hover:underline">削除</button>
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

      {showSourceMaster && <SourceMasterModal onClose={() => setShowSourceMaster(false)} />}

      {showForm && (
        <AICampConsultationForm
          members={members}
          initial={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={() => { setShowForm(false); setEditTarget(null); fetchAll() }}
        />
      )}
    </div>
  )
}
