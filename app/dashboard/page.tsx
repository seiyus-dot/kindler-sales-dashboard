'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, WeeklyLog, DealToB, DealToC, AICampConsultation, Member } from '@/lib/supabase'
import DealToBForm from '@/components/DealToBForm'
import DealToCForm from '@/components/DealToCForm'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts'
import {
  TrendingUp, Briefcase, User, CreditCard, ArrowUpRight, ArrowDownRight, Target, AlertTriangle
} from 'lucide-react'

type View = 'all' | 'tob' | 'toc'
type Period = 'month' | 'all'
type FunnelView = 'tob' | 'toc'

const TOB_FUNNEL_STAGES = ['リード', 'アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'クロージング']
const TOC_FUNNEL_STAGES = ['相談予約', 'ヒアリング', '提案中', 'クロージング', '相談済']

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
  const [aicampDeals, setAicampDeals] = useState<AICampConsultation[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('all')
  const [period, setPeriod] = useState<Period>('month')
  const [funnelView, setFunnelView] = useState<FunnelView>('tob')
  const [showTobForm, setShowTobForm] = useState(false)
  const [showTocForm, setShowTocForm] = useState(false)
  const [editingTob, setEditingTob] = useState<DealToB | null>(null)
  const [editingToc, setEditingToc] = useState<DealToC | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const currentMonth = new Date().toISOString().slice(0, 7)

  async function fetchDeals() {
    const [tobRes, tocRes] = await Promise.all([
      supabase.from('deals_tob').select('*, member:members!member_id(name)'),
      supabase.from('deals_toc').select('*, member:members!member_id(name)'),
    ])
    if (tobRes.data) setTobDeals(tobRes.data)
    if (tocRes.data) setTocDeals(tocRes.data)
  }

  useEffect(() => {
    async function fetchAll() {
      const [logsRes, membersRes, tobRes, tocRes, aicampRes] = await Promise.all([
        supabase.from('weekly_logs').select('*').order('log_date'),
        supabase.from('members').select('*').order('sort_order'),
        supabase.from('deals_tob').select('*, member:members!member_id(name)'),
        supabase.from('deals_toc').select('*, member:members!member_id(name)'),
        supabase.from('aicamp_consultations').select('*').eq('status', '成約'),
      ])
      if (logsRes.data) setLogs(logsRes.data)
      if (membersRes.data) setMembers(membersRes.data)
      if (tobRes.data) setTobDeals(tobRes.data)
      if (tocRes.data) setTocDeals(tocRes.data)
      if (aicampRes.data) setAicampDeals(aicampRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const latest = logs[logs.length - 1]

  const activeTob = view === 'toc' ? [] : tobDeals
  const activeToc = view === 'tob' ? [] : tocDeals
  const allDeals = [...activeTob, ...activeToc]

  // KPI
  const paidDeals = allDeals.filter(d =>
    d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth))
  )
  const paidTotal = paidDeals.reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const paidCount = paidDeals.length

  const activeDeals = allDeals.filter(d => !['受注', '失注'].includes(d.status ?? ''))

  // 加重パイプライン（deals テーブルから自動計算）
  const weightedPipeline = activeDeals.reduce((s, d) => {
    return s + Math.round((d.expected_amount ?? 0) * (d.win_probability ?? 0) / 100)
  }, 0)
  const rawPipeline = activeDeals.reduce((s, d) => s + (d.expected_amount ?? 0), 0)

  const wonCount = allDeals.filter(d => d.status === '受注').length
  const winRate = allDeals.length > 0 ? Math.round((wonCount / allDeals.length) * 100) : 0

  // 放置案件（7日以上 updated_at が古い進行中案件）
  const staleThreshold = new Date(Date.now() - 7 * 86400000).toISOString()
  const staleDeals = [
    ...tobDeals.filter(d => !['受注', '失注'].includes(d.status ?? '') && d.updated_at < staleThreshold)
      .map(d => ({ id: d.id, label: d.company_name, member: d.member?.name, type: '法人' as const, updatedAt: d.updated_at })),
    ...tocDeals.filter(d => !['受注', '失注'].includes(d.status ?? '') && d.updated_at < staleThreshold)
      .map(d => ({ id: d.id, label: d.name, member: d.member?.name, type: '個人' as const, updatedAt: d.updated_at })),
  ].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))

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
    const names = Array.from(new Set(paidDeals.map(d => d.member?.name))).filter(Boolean)
    return names.map(name => ({
      name,
      金額: paidDeals.filter(d => d.member?.name === name)
        .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0),
    })).sort((a, b) => b.金額 - a.金額)
  }, [paidDeals])

  // サービス別着金（deals_tob + aicamp_consultations）
  const servicePaid = useMemo(() => {
    // deals_tob のサービス別（万円単位）
    const tobPaid = view === 'toc' ? [] : tobDeals.filter(d =>
      d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth))
    )
    const tobByService: Record<string, number> = {}
    for (const d of tobPaid) {
      const key = d.service ?? 'その他'
      tobByService[key] = (tobByService[key] ?? 0) + (d.actual_amount ?? d.expected_amount ?? 0)
    }

    // aicamp_consultations のサービス別（円→万円に変換）
    const aicampPaid = aicampDeals.filter(d =>
      (d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth))) ||
      (d.consultation_date && (period === 'all' || d.consultation_date.startsWith(currentMonth)))
    )
    const aicampByService: Record<string, number> = {}
    for (const d of aicampPaid) {
      const key = d.service_type ?? 'AI CAMP'
      aicampByService[key] = (aicampByService[key] ?? 0) + Math.round((d.payment_amount ?? 0) / 10000)
    }

    const allKeys = new Set([...Object.keys(tobByService), ...Object.keys(aicampByService)])
    return Array.from(allKeys).map(name => ({
      name,
      金額: (tobByService[name] ?? 0) + (aicampByService[name] ?? 0),
    })).filter(r => r.金額 > 0).sort((a, b) => b.金額 - a.金額)
  }, [tobDeals, aicampDeals, view, period, currentMonth])

  // パイチャート
  const paidTobTotal = tobDeals
    .filter(d => d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth)))
    .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const paidTocTotal = tocDeals
    .filter(d => d.payment_date && (period === 'all' || d.payment_date.startsWith(currentMonth)))
    .reduce((s, d) => s + (d.actual_amount ?? d.expected_amount ?? 0), 0)
  const pieData = view === 'all'
    ? [{ name: '法人', value: paidTobTotal }, { name: '個人', value: paidTocTotal }]
    : view === 'tob'
      ? [{ name: '受注', value: wonCount }, { name: '進行中', value: activeDeals.length }]
      : [{ name: '受注', value: wonCount }, { name: '進行中', value: activeDeals.length }]

  // 期日アラート
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const alerts = [
    ...tobDeals.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.company_name, action: d.next_action, date: d.next_action_date!, member: d.member?.name, type: '法人' as const })),
    ...tocDeals.filter(d => d.next_action_date && d.next_action_date >= today && d.next_action_date <= in7)
      .map(d => ({ id: d.id, label: d.name, action: d.next_action, date: d.next_action_date!, member: d.member?.name, type: '個人' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // ファネルデータ
  const funnelData = useMemo(() => {
    const stages = funnelView === 'tob' ? TOB_FUNNEL_STAGES : TOC_FUNNEL_STAGES
    const deals = funnelView === 'tob' ? tobDeals : tocDeals
    return stages.map((stage, i) => {
      const count = deals.filter(d => d.status === stage).length
      const prevCount = i > 0
        ? deals.filter(d => d.status === stages[i - 1]).length
        : null
      const convRate = prevCount != null && prevCount > 0
        ? Math.round((count / prevCount) * 100)
        : null
      return { stage, count, convRate }
    }).filter(d => d.count > 0 || d.stage === stages[0])
  }, [tobDeals, tocDeals, funnelView])

  // 失注理由分布
  const lossReasonData = useMemo(() => {
    const lostTob = tobDeals.filter(d => d.status === '失注' && d.loss_reason)
    const lostToc = tocDeals.filter(d => d.status === '失注' && d.loss_reason)
    const all = [...lostTob, ...lostToc]
    const reasons = Array.from(new Set(all.map(d => d.loss_reason!))).filter(Boolean)
    return reasons.map(r => ({
      name: r,
      件数: all.filter(d => d.loss_reason === r).length,
    })).sort((a, b) => b.件数 - a.件数)
  }, [tobDeals, tocDeals])

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
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* 新規追加ボタン */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition"
            >
              + 新規案件
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden w-32">
                <button
                  onClick={() => { setEditingTob(null); setShowTobForm(true); setShowAddMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 transition"
                >
                  法人案件
                </button>
                <button
                  onClick={() => { setEditingToc(null); setShowTocForm(true); setShowAddMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-pink-600 font-medium hover:bg-pink-50 transition"
                >
                  個人案件
                </button>
              </div>
            )}
          </div>
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

      {/* 放置案件アラート */}
      {staleDeals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-500" />
            <p className="text-sm font-bold text-amber-700">
              7日以上更新されていない進行中案件 — {staleDeals.length}件
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {staleDeals.slice(0, 8).map(d => {
              const days = Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000)
              const fullDeal = d.type === '法人'
                ? tobDeals.find(t => t.id === d.id)
                : tocDeals.find(t => t.id === d.id)
              return (
                <button
                  key={d.id}
                  onClick={() => d.type === '法人'
                    ? (setEditingTob(fullDeal as DealToB ?? null), setShowTobForm(true))
                    : (setEditingToc(fullDeal as DealToC ?? null), setShowTocForm(true))
                  }
                  className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs hover:border-amber-400 hover:shadow-sm transition"
                >
                  <span className={`font-bold ${d.type === '法人' ? 'text-blue-600' : 'text-pink-600'}`}>{d.type}</span>
                  <span className="text-gray-700">{d.label}</span>
                  <span className="text-gray-400">{d.member}</span>
                  <span className="text-amber-600 font-bold">{days}日放置</span>
                </button>
              )
            })}
            {staleDeals.length > 8 && (
              <span className="text-xs text-amber-500 flex items-center">他 {staleDeals.length - 8}件</span>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
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
          title="加重パイプライン"
          value={`${weightedPipeline.toLocaleString()}万円`}
          sub={`原価合計 ${rawPipeline.toLocaleString()}万円 / 進行中 ${activeDeals.length}件`}
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
        <div className="col-span-1 lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
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

        <div className="col-span-1 lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">
            {view === 'all' ? `着金比率（${period === 'month' ? '当月' : '全体'}）` : 'ステータス内訳'}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">
            {view === 'all' ? 'サービス別 着金額（万円）' : '担当者別 着金額（万円）'}
          </h3>
          {(view === 'all' ? servicePaid : memberPaid).length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">着金データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={view === 'all' ? servicePaid : memberPaid} layout="vertical" margin={{ right: 60 }}>
                <XAxis type="number" hide domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.4)]} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()}万円`} />
                <Bar dataKey="金額" radius={[0, 4, 4, 0]} barSize={20} fill={view === 'all' ? '#ec4899' : '#6366f1'}>
                  <LabelList dataKey="金額" position="right" formatter={(v: number) => `${v.toLocaleString()}万`} style={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

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
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors group">
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
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            if (a.type === '法人') { setEditingTob(tobDeals.find(d => d.id === a.id) ?? null); setShowTobForm(true) }
                            else { setEditingToc(tocDeals.find(d => d.id === a.id) ?? null); setShowTocForm(true) }
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition font-medium"
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ファネル & 失注分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* パイプラインファネル */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-900">パイプライン ファネル</h3>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
              {(['tob', 'toc'] as FunnelView[]).map(v => (
                <button
                  key={v}
                  onClick={() => setFunnelView(v)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    funnelView === v
                      ? v === 'tob' ? 'bg-white text-blue-600 shadow-sm' : 'bg-white text-pink-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {v === 'tob' ? '法人' : '個人'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {funnelData.map((d, i) => {
              const maxCount = Math.max(...funnelData.map(x => x.count), 1)
              const width = maxCount > 0 ? Math.max((d.count / maxCount) * 100, 8) : 8
              return (
                <div key={d.stage}>
                  {d.convRate !== null && i > 0 && (
                    <div className="flex items-center gap-2 py-0.5 pl-2">
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-200" />
                      <span className="text-xs text-slate-400 font-mono">{d.convRate}%</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium w-20 flex-shrink-0 text-right">{d.stage}</span>
                    <div className="flex-1 bg-slate-50 rounded-full h-7 overflow-hidden">
                      <div
                        className={`h-full rounded-full flex items-center justify-end pr-2 transition-all ${funnelView === 'tob' ? 'bg-indigo-500' : 'bg-pink-500'}`}
                        style={{ width: `${width}%` }}
                      >
                        <span className="text-xs font-bold text-white">{d.count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {funnelData.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">データがありません</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4 text-xs text-slate-400">
            <span>受注: <span className="font-bold text-green-600">{(funnelView === 'tob' ? tobDeals : tocDeals).filter(d => d.status === '受注').length}件</span></span>
            <span>失注: <span className="font-bold text-red-500">{(funnelView === 'tob' ? tobDeals : tocDeals).filter(d => d.status === '失注').length}件</span></span>
          </div>
        </div>

        {/* 失注理由分析 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-5">失注理由 分布</h3>
          {lossReasonData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm text-center">
              <div>
                <p>失注理由データがありません</p>
                <p className="text-xs mt-1">案件を失注にして「アクション履歴」タブから議事録を貼り付けると自動分析されます</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={lossReasonData} layout="vertical" margin={{ right: 50 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                <Tooltip formatter={(v: number) => `${v}件`} />
                <Bar dataKey="件数" radius={[0, 4, 4, 0]} barSize={20} fill="#f43f5e">
                  <LabelList dataKey="件数" position="right" style={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* モーダル */}
      {showTobForm && (
        <DealToBForm
          members={members}
          initial={editingTob}
          onClose={() => setShowTobForm(false)}
          onSaved={() => { setShowTobForm(false); fetchDeals() }}
        />
      )}
      {showTocForm && (
        <DealToCForm
          members={members}
          initial={editingToc}
          onClose={() => setShowTocForm(false)}
          onSaved={() => { setShowTocForm(false); fetchDeals() }}
        />
      )}
    </div>
  )
}
