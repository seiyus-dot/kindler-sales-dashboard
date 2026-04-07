'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase, Member, DealToB, DealToC, DealAction, ACTION_TYPES } from '@/lib/supabase'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import DealToBForm from '@/components/DealToBForm'
import DealToCForm from '@/components/DealToCForm'

const TOB_STATUSES = ['アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'リード', '受注', '失注', '保留']
const TOC_STATUSES = ['相談予約', 'ヒアリング', '提案中', 'クロージング', '相談済', '受注', '失注', '保留']

function statusBadge(status?: string) {
  const s = status ?? ''
  if (s === '受注') return 'bg-green-100 text-green-700'
  if (s === '失注') return 'bg-red-100 text-red-600'
  if (['クロージング', '見積提出'].includes(s)) return 'bg-blue-100 text-blue-700'
  if (s === '保留') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [member, setMember] = useState<Member | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [tocDeals, setTocDeals] = useState<DealToC[]>([])
  const [actions, setActions] = useState<DealAction[]>([])
  const [loading, setLoading] = useState(true)
  const [showToBForm, setShowToBForm] = useState(false)
  const [showToCForm, setShowToCForm] = useState(false)
  const [editToB, setEditToB] = useState<DealToB | null>(null)
  const [editToC, setEditToC] = useState<DealToC | null>(null)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function fetchAll() {
    const [memberRes, membersRes, tobRes, tocRes] = await Promise.all([
      supabase.from('members').select('*').eq('id', id).single(),
      supabase.from('members').select('*').order('sort_order'),
      supabase.from('deals_tob').select('*').eq('member_id', id).order('created_at', { ascending: false }),
      supabase.from('deals_toc').select('*').eq('member_id', id).order('created_at', { ascending: false }),
    ])
    if (memberRes.data) setMember(memberRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    const tob: DealToB[] = tobRes.data ?? []
    const toc: DealToC[] = tocRes.data ?? []
    setTobDeals(tob)
    setTocDeals(toc)

    const dealIds = [...tob.map(d => d.id), ...toc.map(d => d.id)]
    if (dealIds.length > 0) {
      const { data: actionsData } = await supabase
        .from('deal_actions')
        .select('*')
        .in('deal_id', dealIds)
        .order('action_date', { ascending: false })
      if (actionsData) setActions(actionsData)
    } else {
      setActions([])
    }

    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-base">読み込み中...</div>
  )
  if (!member) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-base">メンバーが見つかりません</div>
  )

  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const tobActive = tobDeals.filter(d => !['受注', '失注'].includes(d.status ?? '')).length
  const tocActive = tocDeals.filter(d => !['受注', '失注'].includes(d.status ?? '')).length
  const pipeline = [...tobDeals, ...tocDeals]
    .filter(d => !['受注', '失注'].includes(d.status ?? ''))
    .reduce((s, d) => s + (d.expected_amount ?? 0), 0)
  const paidAmount = [...tobDeals, ...tocDeals]
    .filter(d => d.payment_date)
    .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const wonCount = tobDeals.filter(d => d.status === '受注').length + tocDeals.filter(d => d.status === '受注').length
  const totalDeals = tobDeals.length + tocDeals.length
  const winRate = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0

  const alerts = [
    ...tobDeals
      .filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.company_name, action: d.next_action, date: d.next_action_date!, type: '法人' as const })),
    ...tocDeals
      .filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.name, action: d.next_action, date: d.next_action_date!, type: '個人' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const tobStatusCounts = TOB_STATUSES.map(s => ({ status: s, count: tobDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)
  const tocStatusCounts = TOC_STATUSES.map(s => ({ status: s, count: tocDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)

  const totalActions = actions.length
  const thisMonthActions = actions.filter(a => a.action_date.startsWith(currentMonth)).length
  const activeDealsCount = tobActive + tocActive
  const actionsPerDeal = activeDealsCount > 0 ? (totalActions / activeDealsCount).toFixed(1) : '-'

  const actionTypeCounts = ACTION_TYPES.map(t => ({
    type: t,
    count: actions.filter(a => a.action_type === t).length,
  })).filter(x => x.count > 0).sort((a, b) => b.count - a.count)

  const recentActions = actions.slice(0, 5)

  const allMemberDeals = [...tobDeals, ...tocDeals]
  const stageDistribution = [
    '初回接触', 'アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'クロージング',
    '相談予約', 'ヒアリング', '提案中', '相談済'
  ].map(s => ({ stage: s, count: allMemberDeals.filter(d => d.status === s).length }))
    .filter(d => d.count > 0)

  return (
    <div className="space-y-6 lg:space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 lg:gap-4">
        <Link href="/members" className="text-sm text-gray-400 hover:text-gray-600 transition">← 一覧</Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-black text-base">
            {member.name.slice(0, 1)}
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight">{member.name}</h1>
        </div>
      </div>

      {/* 結果KPI - スマホ横スクロール */}
      <div className="flex lg:grid lg:grid-cols-5 gap-3 lg:gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:overflow-x-visible snap-x snap-mandatory lg:snap-none">
        {[
          { label: '進行中（法人）', value: tobActive, unit: '件', accent: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '進行中（個人）', value: tocActive, unit: '件', accent: 'text-cyan-600', bg: 'bg-cyan-50' },
          { label: '期待売上', value: pipeline.toLocaleString(), unit: '万円', accent: 'text-gray-800', bg: 'bg-white' },
          { label: '着金済み', value: paidAmount.toLocaleString(), unit: '万円', accent: 'text-green-600', bg: 'bg-green-50' },
          { label: '受注率', value: winRate, unit: '%', accent: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded border border-gray-100 px-4 lg:px-5 py-3 lg:py-4 min-w-[140px] flex-shrink-0 lg:flex-shrink lg:min-w-0 snap-start`}>
            <p className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 lg:mb-2 whitespace-nowrap">{k.label}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl lg:text-3xl font-black font-mono ${k.accent}`}>{k.value}</span>
              <span className="text-xs lg:text-sm text-gray-400 font-bold">{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 行動KPI */}
      <div className="bg-white rounded border border-gray-100 shadow-sm p-4 lg:p-7">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 lg:mb-5">行動KPI</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5 lg:mb-6">
          {[
            { label: '総アクション数', value: totalActions, unit: '件', color: 'text-blue-600' },
            { label: '今月のアクション', value: thisMonthActions, unit: '件', color: 'text-indigo-600' },
            { label: '1案件あたり平均', value: actionsPerDeal, unit: 'アクション', color: 'text-purple-600' },
            { label: '進行中案件数', value: activeDealsCount, unit: '件', color: 'text-gray-700' },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded px-3 lg:px-4 py-2.5 lg:py-3">
              <p className="text-[10px] lg:text-xs font-black text-gray-400 mb-1">{k.label}</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl lg:text-2xl font-black font-mono ${k.color}`}>{k.value}</span>
                <span className="text-[10px] lg:text-xs text-gray-400">{k.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {actionTypeCounts.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-3">アクション種別内訳</p>
            <div className="space-y-2">
              {actionTypeCounts.map(({ type, count }) => {
                const pct = totalActions > 0 ? Math.round((count / totalActions) * 100) : 0
                return (
                  <div key={type} className="flex items-center gap-2 lg:gap-3">
                    <span className="text-[10px] lg:text-xs text-gray-600 font-medium w-16 lg:w-20 flex-shrink-0">{type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] lg:text-xs font-mono text-gray-500 w-10 lg:w-12 text-right">{count}件</span>
                    <span className="text-[10px] lg:text-xs text-gray-400 w-7 lg:w-8">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {totalActions === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">アクション記録がありません。案件詳細からアクションを記録してください。</p>
        )}
      </div>

      {/* 直近アクション */}
      {recentActions.length > 0 && (
        <div className="bg-white rounded border border-gray-100 shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 lg:mb-5">直近のアクション</h3>
          <div className="space-y-3">
            {recentActions.map(a => {
              const deal = [...tobDeals, ...tocDeals].find(d => d.id === a.deal_id)
              const dealLabel = deal ? ('company_name' in deal ? deal.company_name : deal.name) : '-'
              return (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 flex-shrink-0">{a.action_date}</span>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded flex-shrink-0">{a.action_type}</span>
                  </div>
                  <div className="flex items-center gap-2 pl-0 sm:pl-0">
                    <span className="text-gray-600 text-xs font-medium">{dealLabel}</span>
                    {a.notes && <span className="text-gray-400 text-xs truncate max-w-[200px] lg:max-w-xs">{a.notes}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ファネル */}
      {stageDistribution.length > 0 && (
        <div className="bg-white rounded border border-gray-100 shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 lg:mb-5">ステージ分布</h3>
          <div className="space-y-2">
            {stageDistribution.map(({ stage, count }) => {
              const maxCount = Math.max(...stageDistribution.map(d => d.count), 1)
              const pct = Math.max((count / maxCount) * 100, 8)
              return (
                <div key={stage} className="flex items-center gap-2 lg:gap-3">
                  <span className="text-[10px] lg:text-xs text-gray-500 font-medium w-16 lg:w-20 flex-shrink-0 text-right">{stage}</span>
                  <div className="flex-1 bg-gray-50 rounded-full h-5 lg:h-6 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${pct}%` }}
                    >
                      <span className="text-[10px] lg:text-xs font-bold text-white">{count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* アラート */}
      {alerts.length > 0 && (
        <div className="bg-white rounded border border-amber-100 shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-4 lg:mb-5">
            期日アラート — 7日以内
          </h3>
          <div className="space-y-2 lg:space-y-3">
            {alerts.map(deal => (
              <div key={deal.id} className="flex flex-wrap items-center gap-2 lg:gap-4 text-sm lg:text-base bg-amber-50 rounded px-3 lg:px-4 py-2.5 lg:py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${deal.type === '法人' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'}`}>
                  {deal.type}
                </span>
                <span className="font-bold text-gray-800 text-sm">{deal.label}</span>
                <span className="text-gray-400 text-xs lg:text-sm">{deal.action}</span>
                <span className="ml-auto font-mono font-bold text-amber-600 text-xs lg:text-sm">{deal.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ステータス内訳 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
        <div className="bg-white rounded border border-gray-100 shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 lg:mb-5">法人 ステータス内訳</h3>
          {tobStatusCounts.length === 0 ? (
            <p className="text-base text-gray-400 text-center py-4">案件なし</p>
          ) : (
            <div className="space-y-3">
              {tobStatusCounts.map(({ status, count }) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge(status)}`}>{status}</span>
                  <span className="text-base font-black font-mono text-gray-700">{count}件</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded border border-gray-100 shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 lg:mb-5">個人 ステータス内訳</h3>
          {tocStatusCounts.length === 0 ? (
            <p className="text-base text-gray-400 text-center py-4">案件なし</p>
          ) : (
            <div className="space-y-3">
              {tocStatusCounts.map(({ status, count }) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge(status)}`}>{status}</span>
                  <span className="text-base font-black font-mono text-gray-700">{count}件</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 法人案件テーブル */}
      <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            法人案件 ({tobDeals.length}件)
          </h3>
          <button
            onClick={() => { setEditToB(null); setShowToBForm(true) }}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
          >
            <Plus size={13} />
            法人案件を追加
          </button>
        </div>
        {tobDeals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">案件がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['企業名', 'ステータス', '見込み金額', '受注確度', '次回期日', '次回アクション', ''].map(h => (
                    <th key={h} className="text-left text-xs font-black text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tobDeals.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => { setEditToB(d); setShowToBForm(true) }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-800">{d.company_name}</td>
                    <td className="py-3 pr-4">
                      {d.status && <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge(d.status)}`}>{d.status}</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-700">{d.expected_amount?.toLocaleString() ?? '-'}万円</td>
                    <td className="py-3 pr-4 font-mono text-gray-500">{d.win_probability != null ? `${d.win_probability}%` : '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 text-sm">{d.next_action_date ?? '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 text-sm">{d.next_action ?? '-'}</td>
                    <td className="py-3">
                      <button onClick={(e) => { e.stopPropagation(); setEditToB(d); setShowToBForm(true) }} className="text-xs text-blue-600 hover:text-blue-800 font-bold">編集</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 個人案件テーブル */}
      <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            個人案件 ({tocDeals.length}件)
          </h3>
          <button
            onClick={() => { setEditToC(null); setShowToCForm(true) }}
            className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded transition-colors"
          >
            <Plus size={13} />
            個人案件を追加
          </button>
        </div>
        {tocDeals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">案件がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['氏名', 'ステータス', '見込み金額', '受注確度', '次回期日', '次回アクション', ''].map(h => (
                    <th key={h} className="text-left text-xs font-black text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tocDeals.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => { setEditToC(d); setShowToCForm(true) }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-800">{d.name}</td>
                    <td className="py-3 pr-4">
                      {d.status && <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge(d.status)}`}>{d.status}</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-700">{d.expected_amount?.toLocaleString() ?? '-'}万円</td>
                    <td className="py-3 pr-4 font-mono text-gray-500">{d.win_probability != null ? `${d.win_probability}%` : '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 text-sm">{d.next_action_date ?? '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 text-sm">{d.next_action ?? '-'}</td>
                    <td className="py-3">
                      <button onClick={(e) => { e.stopPropagation(); setEditToC(d); setShowToCForm(true) }} className="text-xs text-blue-600 hover:text-blue-800 font-bold">編集</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 法人案件フォームモーダル */}
      {showToBForm && (
        <DealToBForm
          members={members}
          initial={editToB}
          defaultMemberId={id}
          onClose={() => { setShowToBForm(false); setEditToB(null) }}
          onSaved={() => { setShowToBForm(false); setEditToB(null); fetchAll() }}
        />
      )}

      {/* 個人案件フォームモーダル */}
      {showToCForm && (
        <DealToCForm
          members={members}
          initial={editToC}
          defaultMemberId={id}
          onClose={() => { setShowToCForm(false); setEditToC(null) }}
          onSaved={() => { setShowToCForm(false); setEditToC(null); fetchAll() }}
        />
      )}


    </div>
  )
}
