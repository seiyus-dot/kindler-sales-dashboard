'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, WeeklyLog, DealToB, DealToC } from '@/lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts'
import {
  TrendingUp, Briefcase, User, CreditCard, ArrowUpRight, ArrowDownRight, Target
} from 'lucide-react'

type View = 'all' | 'tob' | 'toc'
type Period = 'month' | 'all'

function StatCard({
  title, value, sub, icon: Icon, colorClass, change, isPositive
}: {
  title: string; value: string; sub?: string; icon: React.ElementType
  colorClass: string; change?: string; isPositive?: boolean
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-xl ${colorClass}`}>
          <Icon size={20} />
        </div>
        {change && (
          <div className={`flex items-center text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
            {isPositive
              ? <ArrowUpRight size={14} className="mr-0.5" />
              : <ArrowDownRight size={14} className="mr-0.5" />}
            {change}
          </div>
        )}
      </div>
      <p className="text-slate-400 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">{value}</h3>
      {sub && <p className="text-xs text-slate-300 mt-0.5">{sub}</p>}
    </div>
  )
}

// 直近N月のYYYY-MMリストを生成
function recentMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export default function DashboardPage() {
  const [logs, setLogs] = useState<WeeklyLog[]>([])
  const [tobDeals, setTobDeals] = useState<DealToB[]>([])
  const [tocDeals, setTocDeals] = useState<DealToC[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('all')
  const [period, setPeriod] = useState<Period>('month')
  const currentMonth = new Date().toISOString().slice(0, 7)

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

  // ビューでフィルタ
  const activeTob = view === 'toc' ? [] : tobDeals
  const activeToc = view === 'tob' ? [] : tocDeals
  const allDeals = [...activeTob, ...activeToc]

  // KPI（着金は period でフィルタ）
  const paidDeals = allDeals.filter(d =>
    d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth))
  )
  const paidTotal = paidDeals.reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const paidCount = paidDeals.length

  const activeDeals = allDeals.filter(d => !['受注', '失注'].includes(d.status ?? ''))
  const pipeline = activeDeals.reduce((s, d) => s + (d.expected_amount ?? 0), 0)

  const wonCount = allDeals.filter(d => d.status === '受注').length
  const winRate = allDeals.length > 0 ? Math.round((wonCount / allDeals.length) * 100) : 0

  // 月次着金チャート
  const months6 = useMemo(() => recentMonths(6), [])
  const monthlyData = useMemo(() => {
    return months6.map(m => {
      const label = m.slice(5) + '月'
      const tob = (view !== 'toc' ? tobDeals : [])
        .filter(d => d.payment_date?.startsWith(m))
        .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
      const toc = (view !== 'tob' ? tocDeals : [])
        .filter(d => d.payment_date?.startsWith(m))
        .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
      return { name: label, 法人: tob, 個人: toc }
    })
  }, [tobDeals, tocDeals, months6, view])

  // 担当別着金
  const memberPaid = useMemo(() => {
    const names = Array.from(new Set(paidDeals.map(d => d.members?.name))).filter(Boolean)
    return names.map(name => ({
      name,
      金額: paidDeals.filter(d => d.members?.name === name)
        .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0),
    })).sort((a, b) => b.金額 - a.金額)
  }, [paidDeals])

  // サービス別着金
  const servicePaid = useMemo(() => {
    const services = Array.from(new Set(paidDeals.map(d => d.service ?? 'その他'))).filter(Boolean)
    return services.map(name => ({
      name,
      金額: paidDeals.filter(d => (d.service ?? 'その他') === name)
        .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0),
    })).sort((a, b) => b.金額 - a.金額)
  }, [paidDeals])

  // パイチャート: 法人/個人 着金比率（period でフィルタ）
  const paidTobTotal = tobDeals
    .filter(d => d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth)))
    .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const paidTocTotal = tocDeals
    .filter(d => d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth)))
    .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const pieData = view === 'all'
    ? [{ name: '法人', value: paidTobTotal }, { name: '個人', value: paidTocTotal }]
    : view === 'tob'
      ? tobDeals.filter(d => d.status === '受注').length > 0
        ? [{ name: '受注', value: wonCount }, { name: '進行中', value: activeDeals.length }]
        : [{ name: 'データなし', value: 1 }]
      : [{ name: '受注', value: wonCount }, { name: '進行中', value: activeDeals.length }]

  // 期日アラート
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const alerts = [
    ...tobDeals.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.company_name, action: d.next_action, date: d.next_action_date!, member: d.members?.name, type: '法人' as const })),
    ...tocDeals.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.name, action: d.next_action, date: d.next_action_date!, member: d.members?.name, type: '個人' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-base">読み込み中...</div>
  )

  const viewLabel = view === 'all' ? '全社合算' : view === 'tob' ? '法人案件のみ' : '個人案件のみ'

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
          <p className="text-slate-400 text-sm mt-0.5">表示中: {viewLabel}　最終更新: {latest?.log_date ?? '-'}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 期間切り替え */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {([
              { key: 'month', label: '当月' },
              { key: 'all',   label: '全体' },
            ] as { key: Period; label: string }[]).map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                  period === p.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* 部門切り替え */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {([
              { key: 'all', label: '全社' },
              { key: 'tob', label: '法人' },
              { key: 'toc', label: '個人' },
            ] as { key: View; label: string }[]).map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                  view === v.key
                    ? v.key === 'tob' ? 'bg-white text-blue-600 shadow-sm'
                      : v.key === 'toc' ? 'bg-white text-pink-600 shadow-sm'
                      : 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="着金済み売上"
          value={`${paidTotal.toLocaleString()}万円`}
          sub={`${paidCount}件`}
          icon={CreditCard}
          colorClass="bg-emerald-50 text-emerald-600"
          change="+実績"
          isPositive={true}
        />
        <StatCard
          title="見込みパイプライン"
          value={`${pipeline.toLocaleString()}万円`}
          sub={`進行中 ${activeDeals.length}件`}
          icon={TrendingUp}
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title={view === 'toc' ? '個人 進行中' : '法人 進行中'}
          value={`${view === 'toc' ? activeToc.filter(d => !['受注','失注'].includes(d.status??'')).length : activeTob.filter(d => !['受注','失注'].includes(d.status??'')).length}件`}
          sub="受注・失注除く"
          icon={view === 'toc' ? User : Briefcase}
          colorClass={view === 'toc' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}
        />
        <StatCard
          title="受注率"
          value={`${winRate}%`}
          sub={`受注 ${wonCount}件 / 全 ${allDeals.length}件`}
          icon={Target}
          colorClass="bg-amber-50 text-amber-600"
          change={wonCount > 0 ? `受注${wonCount}件` : undefined}
          isPositive={true}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 月次着金推移 */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">月次 着金額推移（万円）</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={v => `${v}万`} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()}万円`} />
              <Legend verticalAlign="top" align="right" height={36} />
              <Area type="monotone" name="法人" dataKey="法人" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
              <Area type="monotone" name="個人" dataKey="個人" stackId="1" stroke="#ec4899" fill="#ec4899" fillOpacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* パイ: 法人/個人比率 */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">
            {view === 'all'
              ? `着金比率（${period === 'month' ? '当月' : '全体'}）`
              : 'ステータス内訳'}
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={['#6366f1', '#ec4899'][i % 2]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => view === 'all' ? `${v.toLocaleString()}万円` : `${v}件`} />
              <Legend verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* サービス別 or 担当別着金 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">
            {view === 'all' ? 'サービス別 着金額（万円）' : '担当者別 着金額（万円）'}
          </h3>
          {(view === 'all' ? servicePaid : memberPaid).length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">着金データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={view === 'all' ? servicePaid : memberPaid}
                layout="vertical"
                margin={{ right: 60 }}
              >
                <XAxis
                  type="number"
                  hide
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.4)]}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  width={110}
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }}
                />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()}万円`} />
                <Bar dataKey="金額" radius={[0, 4, 4, 0]} barSize={20} fill={view === 'all' ? '#ec4899' : '#6366f1'}>
                  <LabelList
                    dataKey="金額"
                    position="right"
                    formatter={(v: number) => `${v.toLocaleString()}万`}
                    style={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 期日アラート or 最新メモ */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">
              {alerts.length > 0 ? `期日アラート（${alerts.length}件）` : '直近アクション'}
            </h3>
          </div>
          {alerts.length === 0 ? (
            <div className="p-6 text-slate-400 text-sm text-center py-12">
              7日以内のアクション予定はありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-5 py-3">案件</th>
                    <th className="px-5 py-3">アクション</th>
                    <th className="px-5 py-3 text-right">期日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${a.type === '法人' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                            {a.type}
                          </span>
                          <span className="font-medium text-slate-700 text-xs">{a.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{a.action ?? '-'}</td>
                      <td className="px-5 py-3 font-mono font-bold text-amber-500 text-xs text-right">{a.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
