'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase, Member, DealToB, DealToC } from '@/lib/supabase'
import Link from 'next/link'

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
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [tocDeals, setTocDeals] = useState<DealToC[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [memberRes, tobRes, tocRes] = await Promise.all([
        supabase.from('members').select('*').eq('id', id).single(),
        supabase.from('deals_tob').select('*').eq('member_id', id).order('created_at', { ascending: false }),
        supabase.from('deals_toc').select('*').eq('member_id', id).order('created_at', { ascending: false }),
      ])
      if (memberRes.data) setMember(memberRes.data)
      if (tobRes.data) setTobDeals(tobRes.data)
      if (tocRes.data) setTocDeals(tocRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-base">読み込み中...</div>
  )
  if (!member) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-base">メンバーが見つかりません</div>
  )

  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

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

  // ステータス別集計
  const tobStatusCounts = TOB_STATUSES.map(s => ({ status: s, count: tobDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)
  const tocStatusCounts = TOC_STATUSES.map(s => ({ status: s, count: tocDeals.filter(d => d.status === s).length })).filter(x => x.count > 0)

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/members" className="text-sm text-gray-400 hover:text-gray-600 transition">← メンバー一覧</Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-black text-base">
            {member.name.slice(0, 1)}
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{member.name}</h1>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {[
          { label: '進行中（法人）', value: tobActive, unit: '件', accent: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '進行中（個人）', value: tocActive, unit: '件', accent: 'text-cyan-600', bg: 'bg-cyan-50' },
          { label: '期待売上', value: pipeline.toLocaleString(), unit: '万円', accent: 'text-gray-800', bg: 'bg-white' },
          { label: '着金済み', value: paidAmount.toLocaleString(), unit: '万円', accent: 'text-green-600', bg: 'bg-green-50' },
          { label: '受注率', value: winRate, unit: '%', accent: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded border border-gray-100 px-5 py-4`}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{k.label}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono ${k.accent}`}>{k.value}</span>
              <span className="text-sm text-gray-400 font-bold">{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* アラート */}
      {alerts.length > 0 && (
        <div className="bg-white rounded border border-amber-100 shadow-sm p-7">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-5">
            期日アラート — 7日以内にアクションが必要な案件
          </h3>
          <div className="space-y-3">
            {alerts.map(deal => (
              <div key={deal.id} className="flex items-center gap-4 text-base bg-amber-50 rounded px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${deal.type === '法人' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'}`}>
                  {deal.type}
                </span>
                <span className="font-bold text-gray-800">{deal.label}</span>
                <span className="text-gray-400 text-sm">{deal.action}</span>
                <span className="ml-auto font-mono font-bold text-amber-600 text-sm">{deal.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ステータス内訳 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
        <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">法人 ステータス内訳</h3>
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
        <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">個人 ステータス内訳</h3>
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
      {tobDeals.length > 0 && (
        <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">法人案件 ({tobDeals.length}件)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['企業名', 'ステータス', '見込み金額', '受注確度', '次回期日', '次回アクション'].map(h => (
                    <th key={h} className="text-left text-xs font-black text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tobDeals.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-800">{d.company_name}</td>
                    <td className="py-3 pr-4">
                      {d.status && <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge(d.status)}`}>{d.status}</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-700">{d.expected_amount?.toLocaleString() ?? '-'}万円</td>
                    <td className="py-3 pr-4 font-mono text-gray-500">{d.win_probability != null ? `${d.win_probability}%` : '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 text-sm">{d.next_action_date ?? '-'}</td>
                    <td className="py-3 text-gray-500 text-sm">{d.next_action ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 個人案件テーブル */}
      {tocDeals.length > 0 && (
        <div className="bg-white rounded border border-gray-100 shadow-sm p-7">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">個人案件 ({tocDeals.length}件)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['氏名', 'ステータス', '見込み金額', '受注確度', '次回期日', '次回アクション'].map(h => (
                    <th key={h} className="text-left text-xs font-black text-gray-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tocDeals.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-800">{d.name}</td>
                    <td className="py-3 pr-4">
                      {d.status && <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge(d.status)}`}>{d.status}</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-gray-700">{d.expected_amount?.toLocaleString() ?? '-'}万円</td>
                    <td className="py-3 pr-4 font-mono text-gray-500">{d.win_probability != null ? `${d.win_probability}%` : '-'}</td>
                    <td className="py-3 pr-4 text-gray-500 text-sm">{d.next_action_date ?? '-'}</td>
                    <td className="py-3 text-gray-500 text-sm">{d.next_action ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
