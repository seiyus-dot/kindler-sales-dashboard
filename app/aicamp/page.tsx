'use client'

import { useEffect, useState } from 'react'
import { supabase, AICampConsultation, AICampMonthlyGoal, Member } from '@/lib/supabase'
import AICampConsultationForm from '@/components/AICampConsultationForm'
import AIImport from '@/components/AIImport'

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

  useEffect(() => { fetchAll() }, [month])

  async function fetchAll() {
    setLoading(true)
    const [consRes, membersRes, goalRes] = await Promise.all([
      supabase
        .from('aicamp_consultations')
        .select('*, member:members(name)')
        .gte('consultation_date', `${month}-01`)
        .lt('consultation_date', nextMonth(month))
        .order('consultation_date', { ascending: false }),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('aicamp_monthly_goals').select('*').eq('month', month).maybeSingle(),
    ])
    if (consRes.data) setConsultations(consRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    setGoal(goalRes.data ?? null)
    setGoalInput(goalRes.data?.contract_goal?.toString() ?? '50')
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

  async function deleteConsultation(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('aicamp_consultations').delete().eq('id', id)
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
          <h2 className="text-sm font-bold text-gray-700">商談一覧 ({filtered.length}件)</h2>
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
                {['実施日時', '担当者', '氏名', 'ステータス', '着金額', '返事期限', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">商談がありません</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">
                    {c.consultation_date ? new Date(c.consultation_date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{(c.member as any)?.name ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">{c.name ?? c.line_name ?? '-'}</div>
                    {c.occupation && <div className="text-xs text-gray-400">{c.occupation}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status ?? '予定'] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.status ?? '予定'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">
                    {c.payment_amount ? `¥${c.payment_amount.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{c.reply_deadline ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2 justify-end whitespace-nowrap">
                      <button onClick={() => { setEditTarget(c); setShowForm(true) }} className="text-xs text-blue-500 hover:underline">編集</button>
                      <button onClick={() => deleteConsultation(c.id)} className="text-xs text-red-400 hover:underline">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
