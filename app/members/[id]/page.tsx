'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Member, DealToB, DealAction, ACTION_TYPES, AICampConsultation, CONSULTATION_STATUSES } from '@/lib/supabase'
import { DEMO_MEMBERS, DEMO_TOB_DEALS, DEMO_AICAMP, DEMO_DEAL_ACTIONS } from '@/lib/demoData'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import DealToBForm from '@/components/DealToBForm'
import AICampConsultationForm from '@/components/AICampConsultationForm'

const TOB_STATUSES = ['アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'リード', '受注', '失注', '保留']
const AICAMP_ACTIVE_STATUSES = ['予定', '保留']

function statusBadge(status?: string) {
  const s = status ?? ''
  if (s === '受注' || s === '成約') return 'bg-green-100 text-green-700'
  if (s === '失注' || s === 'ドタキャン' || s === 'キャンセル') return 'bg-red-100 text-red-600'
  if (['クロージング', '見積提出'].includes(s)) return 'bg-[#e8eeff] text-navy'
  if (s === '保留') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [member, setMember] = useState<Member | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [aicampDeals, setAicampDeals] = useState<AICampConsultation[]>([])
  const [actions, setActions] = useState<DealAction[]>([])
  const [loading, setLoading] = useState(true)
  const [showToBForm, setShowToBForm] = useState(false)
  const [editToB, setEditToB] = useState<DealToB | null>(null)
  const [showAICampForm, setShowAICampForm] = useState(false)
  const [editAICamp, setEditAICamp] = useState<AICampConsultation | null>(null)

  useEffect(() => {
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function fetchAll() {
    const m = DEMO_MEMBERS.find(m => m.id === id) ?? null
    setMember(m)
    setMembers(DEMO_MEMBERS)
    const tob = DEMO_TOB_DEALS.filter(d => d.member_id === id)
    setTobDeals(tob)
    setAicampDeals(DEMO_AICAMP.filter(d => d.member_id === id))
    setActions(DEMO_DEAL_ACTIONS.filter(a => tob.some(d => d.id === a.deal_id)))
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
  const aicampActive = aicampDeals.filter(d => AICAMP_ACTIVE_STATUSES.includes(d.status ?? '')).length

  const pipeline = tobDeals
    .filter(d => !['受注', '失注'].includes(d.status ?? ''))
    .reduce((s, d) => s + (d.expected_amount ?? 0), 0)

  const paidAmount =
    tobDeals.filter(d => d.payment_date).reduce((s, d) => s + (d.actual_amount ?? 0), 0) +
    aicampDeals.filter(d => d.status === '成約' && d.payment_date).reduce((s, d) => s + Math.round((d.payment_amount ?? 0) / 10000), 0)

  const wonCount = tobDeals.filter(d => d.status === '受注').length + aicampDeals.filter(d => d.status === '成約').length
  const totalDeals = tobDeals.length + aicampDeals.length
  const winRate = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0

  const alerts = [
    ...tobDeals
      .filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.company_name, action: d.next_action, date: d.next_action_date!, type: '法人' as const })),
    ...aicampDeals
      .filter(d => d.reply_deadline && d.reply_deadline >= today && d.reply_deadline <= in7)
      .map(d => ({ id: d.id, label: d.name ?? '-', action: '返答期限', date: d.reply_deadline!, type: 'AI CAMP' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const tobStatusCounts = TOB_STATUSES.map(s => ({ status: s, count: tobDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)
  const aicampStatusCounts = CONSULTATION_STATUSES.map(s => ({ status: s, count: aicampDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)

  const totalActions = actions.length
  const thisMonthActions = actions.filter(a => a.action_date.startsWith(currentMonth)).length
  const activeDealsCount = tobActive + aicampActive
  const actionsPerDeal = activeDealsCount > 0 ? (totalActions / activeDealsCount).toFixed(1) : '-'

  const actionTypeCounts = ACTION_TYPES.map(t => ({
    type: t,
    count: actions.filter(a => a.action_type === t).length,
  })).filter(x => x.count > 0).sort((a, b) => b.count - a.count)

  const recentActions = actions.slice(0, 5)

  const stageDistribution = [
    'アポ取得', '商談中', '提案済', '交渉中', '見積提出',
  ].map(s => ({ stage: s, count: tobDeals.filter(d => d.status === s).length }))
    .filter(d => d.count > 0)

  return (
    <div className="space-y-6 lg:space-y-8 pb-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.15em] text-[#b8902a] mb-1.5 uppercase">KINDLER</p>
        <div className="flex items-center gap-3 lg:gap-4">
          <Link href="/members" className="text-sm text-gray-400 hover:text-gray-600 transition">← 一覧</Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#e8eeff] flex items-center justify-center text-navy font-black text-base">
              {member.name.slice(0, 1)}
            </div>
            <h1 className="text-[17px] lg:text-xl font-bold text-[#1a2540] tracking-tight">{member.name}</h1>
          </div>
        </div>
      </div>

      {/* 結果KPI */}
      <div className="flex lg:grid lg:grid-cols-5 gap-3 lg:gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:overflow-x-visible snap-x snap-mandatory lg:snap-none">
        {[
          { label: '進行中（法人）', value: tobActive, unit: '件', accent: 'text-navy', bg: 'bg-[#f0f4ff]' },
          { label: '進行中（AI CAMP）', value: aicampActive, unit: '件', accent: 'text-[#1a6e6e]', bg: 'bg-[#f0f8ff]' },
          { label: '期待売上', value: pipeline.toLocaleString(), unit: '万円', accent: 'text-[#1a2540]', bg: 'bg-white' },
          { label: '着金済み', value: paidAmount.toLocaleString(), unit: '万円', accent: 'text-[#2a7a4a]', bg: 'bg-[#f0f8f4]' },
          { label: '受注率', value: winRate, unit: '%', accent: 'text-[#b8902a]', bg: 'bg-[#fdf8f0]' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded border border-[#e0e6f0] px-4 lg:px-5 py-3 lg:py-4 min-w-[140px] flex-shrink-0 lg:flex-shrink lg:min-w-0 snap-start`}>
            <p className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 lg:mb-2 whitespace-nowrap">{k.label}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl lg:text-3xl font-black font-mono ${k.accent}`}>{k.value}</span>
              <span className="text-xs lg:text-sm text-gray-400 font-bold">{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 行動KPI */}
      <div className="bg-white rounded border border-[#e0e6f0] shadow-sm p-4 lg:p-7">
        <h3 className="text-xs font-black text-[#8a96b0] uppercase tracking-widest mb-4 lg:mb-5">行動KPI</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5 lg:mb-6">
          {[
            { label: '総アクション数', value: totalActions, unit: '件', color: 'text-navy' },
            { label: '今月のアクション', value: thisMonthActions, unit: '件', color: 'text-navy' },
            { label: '1案件あたり平均', value: actionsPerDeal, unit: 'アクション', color: 'text-[#b8902a]' },
            { label: '進行中案件数', value: activeDealsCount, unit: '件', color: 'text-[#1a2540]' },
          ].map(k => (
            <div key={k.label} className="bg-[#f8f9fd] rounded px-3 lg:px-4 py-2.5 lg:py-3">
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
                      <div className="h-full bg-navy rounded-full" style={{ width: `${pct}%` }} />
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
        <div className="bg-white rounded border border-[#e0e6f0] shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-[#8a96b0] uppercase tracking-widest mb-4 lg:mb-5">直近のアクション</h3>
          <div className="space-y-3">
            {recentActions.map(a => {
              const deal = tobDeals.find(d => d.id === a.deal_id)
              const dealLabel = deal?.company_name ?? '-'
              return (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 flex-shrink-0">{a.action_date}</span>
                    <span className="bg-[#f0f4ff] text-navy text-xs font-bold px-2 py-0.5 rounded flex-shrink-0">{a.action_type}</span>
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
        <div className="bg-white rounded border border-[#e0e6f0] shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-[#8a96b0] uppercase tracking-widest mb-4 lg:mb-5">ステージ分布（法人）</h3>
          <div className="space-y-2">
            {stageDistribution.map(({ stage, count }) => {
              const maxCount = Math.max(...stageDistribution.map(d => d.count), 1)
              const pct = Math.max((count / maxCount) * 100, 8)
              return (
                <div key={stage} className="flex items-center gap-2 lg:gap-3">
                  <span className="text-[10px] lg:text-xs text-gray-500 font-medium w-16 lg:w-20 flex-shrink-0 text-right">{stage}</span>
                  <div className="flex-1 bg-[#f8f9fd] rounded-full h-5 lg:h-6 overflow-hidden">
                    <div
                      className="h-full bg-navy rounded-full flex items-center justify-end pr-2"
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
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  deal.type === '法人' ? 'bg-[#e8eeff] text-navy' : 'bg-green-100 text-green-700'
                }`}>
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
        <div className="bg-white rounded border border-[#e0e6f0] shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-[#8a96b0] uppercase tracking-widest mb-4 lg:mb-5">法人 ステータス内訳</h3>
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
        <div className="bg-white rounded border border-[#e0e6f0] shadow-sm p-4 lg:p-7">
          <h3 className="text-xs font-black text-[#8a96b0] uppercase tracking-widest mb-4 lg:mb-5">商談 ステータス内訳</h3>
          {aicampStatusCounts.length === 0 ? (
            <p className="text-base text-gray-400 text-center py-4">相談なし</p>
          ) : (
            <div className="space-y-3">
              {aicampStatusCounts.map(({ status, count }) => (
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
            className="flex items-center gap-1.5 text-xs font-bold text-navy hover:text-[#152f5a] bg-[#f0f4ff] hover:bg-[#e8eeff] px-3 py-1.5 rounded transition-colors"
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
                      <button onClick={(e) => { e.stopPropagation(); setEditToB(d); setShowToBForm(true) }} className="text-xs text-navy hover:text-[#152f5a] font-bold">編集</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI CAMP相談一覧 */}
      <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            商談一覧 ({aicampDeals.length}件)
          </h3>
          <button
            onClick={() => { setEditAICamp(null); setShowAICampForm(true) }}
            className="flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded transition-colors"
          >
            <Plus size={13} />
            相談を追加
          </button>
        </div>
        {aicampDeals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">相談がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['実施日時', 'サービス', '氏名', 'LINE名', '流入経路', '登録経路', 'ステータス', '着金額', ''].map(h => (
                    <th key={h} className="text-left text-xs font-black text-gray-400 uppercase tracking-wider pb-3 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {aicampDeals.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => { setEditAICamp(d); setShowAICampForm(true) }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{d.consultation_date ? d.consultation_date.slice(0, 16).replace('T', ' ') : '-'}</td>
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{d.service_type ?? '-'}</td>
                    <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{d.name ?? '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{d.line_name ?? '-'}</td>
                    <td className="py-3 pr-4 text-gray-500">{d.source ?? '-'}</td>
                    <td className="py-3 pr-4 text-gray-500">{d.registration_source ?? '-'}</td>
                    <td className="py-3 pr-4">
                      {d.status && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                          { '成約': 'bg-green-100 text-green-700', '失注': 'bg-red-100 text-red-600', '保留': 'bg-amber-100 text-amber-700', 'ドタキャン': 'bg-red-50 text-red-400', 'キャンセル': 'bg-gray-100 text-gray-500', '予定': 'bg-blue-100 text-blue-600' }[d.status] ?? 'bg-gray-100 text-gray-600'
                        }`}>{d.status}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-700 whitespace-nowrap">
                      {d.payment_amount != null ? `¥${d.payment_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3">
                      <button onClick={(e) => { e.stopPropagation(); setEditAICamp(d); setShowAICampForm(true) }} className="text-xs text-green-700 hover:text-green-800 font-bold">編集</button>
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
          onClose={() => { setShowToBForm(false); setEditToB(null); fetchAll() }}
          onSaved={() => { setShowToBForm(false); setEditToB(null); fetchAll() }}
        />
      )}

      {/* AI CAMP相談フォームモーダル */}
      {showAICampForm && (
        <AICampConsultationForm
          members={members}
          initial={editAICamp}
          onClose={() => { setShowAICampForm(false); setEditAICamp(null); fetchAll() }}
          onSaved={() => { setShowAICampForm(false); setEditAICamp(null); fetchAll() }}
        />
      )}
    </div>
  )
}
