'use client'

import { useEffect, useState } from 'react'
import { supabase, WeeklyLog, DealToB, DealToC } from '@/lib/supabase'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function DashboardPage() {
  const [logs, setLogs] = useState<WeeklyLog[]>([])
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [tocDeals, setTocDeals] = useState<DealToC[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [logsRes, tobRes, tocRes] = await Promise.all([
        supabase.from('weekly_logs').select('*').order('log_date'),
        supabase.from('deals_tob').select('*, members(name)'),
        supabase.from('deals_toc').select('*, members(name)'),
      ])
      if (logsRes.data) setLogs(logsRes.data)
      if (tobRes.data) setTobDeals(tobRes.data)
      if (tocRes.data) setTocDeals(tocRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const latest = logs[logs.length - 1]
  const prev = logs[logs.length - 2]

  const pct = (curr?: number, prev?: number) => {
    if (!curr || !prev) return null
    const d = Math.round(((curr - prev) / prev) * 100)
    return { label: `${d > 0 ? '+' : ''}${d}%`, positive: d >= 0 }
  }

  const chartData = logs.map(l => ({
    date: l.log_date.slice(5).replace('-', '/'),
    法人: l.tob_amount,
    個人: l.toc_amount,
    期待売上: l.weighted_total,
  }))

  // 担当別集計
  const memberStats = Array.from(
    new Set([...tobDeals.map(d => d.members?.name), ...tocDeals.map(d => d.members?.name)])
  ).filter(Boolean).map(name => ({
    name,
    tob: tobDeals.filter(d => d.members?.name === name).length,
    toc: tocDeals.filter(d => d.members?.name === name).length,
  })).sort((a, b) => (b.tob + b.toc) - (a.tob + a.toc))
  const maxDeals = Math.max(...memberStats.map(m => m.tob + m.toc), 1)

  // ステータス集計
  const tobActive = tobDeals.filter(d => !['受注', '失注'].includes(d.status ?? '')).length
  const tocActive = tocDeals.filter(d => !['受注', '失注'].includes(d.status ?? '')).length
  const closing = tobDeals.filter(d => ['クロージング', '見積提出'].includes(d.status ?? '')).length
    + tocDeals.filter(d => d.status === 'クロージング').length
  const won = tobDeals.filter(d => d.status === '受注').length + tocDeals.filter(d => d.status === '受注').length

  // 着金済み集計
  const paidTob = tobDeals.filter(d => d.payment_date)
  const paidToc = tocDeals.filter(d => d.payment_date)
  const paidTotal = [...paidTob, ...paidToc]
    .reduce((sum, d) => sum + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const paidCount = paidTob.length + paidToc.length

  // 担当別着金集計
  const memberPaid = Array.from(new Set([...paidTob, ...paidToc].map(d => d.members?.name)))
    .filter(Boolean).map(name => ({
      name,
      amount: [...paidTob, ...paidToc]
        .filter(d => d.members?.name === name)
        .reduce((sum, d) => sum + (d.actual_amount ?? d.expected_amount ?? 0), 0),
    })).sort((a, b) => b.amount - a.amount)

  // 期日アラート（7日以内）
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const upcomingDeals = [
    ...tobDeals.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.company_name, action: d.next_action, date: d.next_action_date!, member: d.members?.name, type: '法人' })),
    ...tocDeals.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.name, action: d.next_action, date: d.next_action_date!, member: d.members?.name, type: '個人' })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">読み込み中...</div>
  )

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">ダッシュボード</h1>
        <p className="text-xs text-gray-400 mt-0.5">最終更新：{latest?.log_date ?? '-'}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: '法人 見込み金額', value: latest?.tob_amount, unit: '万円', trend: pct(latest?.tob_amount, prev?.tob_amount), accent: 'text-blue-600' },
          { label: '個人 見込み金額', value: latest?.toc_amount, unit: '万円', trend: pct(latest?.toc_amount, prev?.toc_amount), accent: 'text-cyan-600' },
          { label: '期待売上見込み', value: latest?.weighted_total, unit: '万円', trend: pct(latest?.weighted_total, prev?.weighted_total), accent: 'text-green-600' },
          { label: '累計受注数', value: latest?.cumulative_orders, unit: '件', trend: pct(latest?.cumulative_orders, prev?.cumulative_orders), accent: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{k.label}</p>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black font-mono ${k.accent}`}>{k.value?.toLocaleString() ?? '-'}</span>
                <span className="text-xs font-bold text-gray-400">{k.unit}</span>
              </div>
              {k.trend && (
                <span className={`text-[11px] font-black ${k.trend.positive ? 'text-green-500' : 'text-red-400'}`}>
                  {k.trend.positive ? '↑' : '↓'} {k.trend.label.replace('+', '').replace('-', '')}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-300 mt-1">前週比</p>
          </div>
        ))}
      </div>

      {/* ステータスサマリー */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '進行中（法人）', value: tobActive, sub: '受注・失注除く', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '進行中（個人）', value: tocActive, sub: '受注・失注除く', color: 'text-cyan-600', bg: 'bg-cyan-50' },
          { label: 'クロージング中', value: closing, sub: '法人＋個人', color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '受注済み', value: won, sub: '法人＋個人 合計', color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 px-5 py-4`}>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{s.label}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-400 font-bold">件</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-5">
        {/* 見込み金額推移 */}
        <div className="col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-6">週次 見込み金額推移（万円）</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }} unit="万" />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()}万円`} />
              <Bar dataKey="法人" fill="#DBEAFE" radius={[4, 4, 0, 0]} barSize={28} />
              <Bar dataKey="個人" fill="#CFFAFE" radius={[4, 4, 0, 0]} barSize={28} />
              <Line type="monotone" dataKey="期待売上" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 担当別案件数 */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-6">担当別 案件数</h3>
          {memberStats.length === 0 ? (
            <p className="text-sm text-gray-400 mt-8 text-center">案件データがありません</p>
          ) : (
            <div className="space-y-4">
              {memberStats.map(m => (
                <div key={m.name}>
                  <div className="flex justify-between text-[11px] font-bold mb-1.5">
                    <span className="text-gray-600">{m.name}</span>
                    <span className="text-gray-400 font-mono">法人:{m.tob} / 個人:{m.toc}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(((m.tob + m.toc) / maxDeals) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 期日アラート */}
      {upcomingDeals.length > 0 && (
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-7">
          <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-5">
            期日アラート — 7日以内にアクションが必要な案件
          </h3>
          <div className="space-y-3">
            {upcomingDeals.map(deal => (
              <div key={deal.id} className="flex items-center gap-4 text-sm bg-amber-50 rounded-xl px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${deal.type === '法人' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'}`}>
                  {deal.type}
                </span>
                <span className="font-bold text-gray-800">{deal.label}</span>
                <span className="text-gray-400 text-xs">{deal.action}</span>
                <span className="ml-auto font-mono font-bold text-amber-600 text-xs">{deal.date}</span>
                <span className="text-gray-400 text-xs">{deal.member}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 着金済み売上 */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">着金済み売上</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-green-600">{paidTotal.toLocaleString()}</span>
            <span className="text-xs text-gray-400 font-bold">万円</span>
            <span className="text-xs text-gray-300 ml-2">{paidCount}件</span>
          </div>
        </div>
        {memberPaid.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">着金データがありません（案件詳細から着金日を入力してください）</p>
        ) : (
          <div className="space-y-3">
            {memberPaid.map(m => (
              <div key={m.name} className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-600 w-16">{m.name}</span>
                <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${Math.round((m.amount / (memberPaid[0].amount || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold text-gray-700 w-24 text-right">{m.amount.toLocaleString()} 万円</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 最新メモ */}
      {latest?.memo && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">
            最新メモ — {latest.log_date}
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed border-l-2 border-blue-200 pl-4">{latest.memo}</p>
        </div>
      )}
    </div>
  )
}
