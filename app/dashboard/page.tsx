'use client'

import { useEffect, useState } from 'react'
import { supabase, WeeklyLog, DealToB, DealToC } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
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

  const delta = (curr?: number, prev?: number) => {
    if (!curr || !prev) return null
    const d = curr - prev
    return d > 0 ? `+${d.toLocaleString()}` : `${d.toLocaleString()}`
  }

  const chartData = logs.map(l => ({
    date: l.log_date.slice(5).replace('-', '/'),
    'toB見込み': l.tob_amount,
    'toC見込み': l.toc_amount,
    '加重合計': l.weighted_total,
  }))

  const memberStats = Array.from(
    new Set([...tobDeals.map(d => d.members?.name), ...tocDeals.map(d => d.members?.name)])
  ).filter(Boolean).map(name => ({
    name,
    tob: tobDeals.filter(d => d.members?.name === name).length,
    toc: tocDeals.filter(d => d.members?.name === name).length,
  }))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>
  )

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Sales Analytics</h1>
        <p className="text-[#8c8c8c] text-sm">Real-time overview of your sales pipeline and performance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          label="toB 見込み金額"
          value={latest?.tob_amount}
          unit="万円"
          delta={delta(latest?.tob_amount, prev?.tob_amount)}
          color="blue"
        />
        <KpiCard
          label="toC 見込み金額"
          value={latest?.toc_amount}
          unit="万円"
          delta={delta(latest?.toc_amount, prev?.toc_amount)}
          color="cyan"
        />
        <KpiCard
          label="加重パイプライン"
          value={latest?.weighted_total}
          unit="万円"
          delta={delta(latest?.weighted_total, prev?.weighted_total)}
          color="violet"
        />
        <KpiCard
          label="累計受注数"
          value={latest?.cumulative_orders}
          unit="件"
          delta={delta(latest?.cumulative_orders, prev?.cumulative_orders)}
          color="amber"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 premium-card p-6 flex flex-col bg-white">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-[#8c8c8c] uppercase tracking-widest">週次 見込み金額推移（万円）</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-[10px] text-[#8c8c8c] font-bold"><span className="w-2 h-2 rounded-full bg-blue-500" /> toB</span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#8c8c8c] font-bold"><span className="w-2 h-2 rounded-full bg-cyan-400" /> toC</span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#8c8c8c] font-bold"><span className="w-2 h-2 rounded-full bg-violet-500" /> 加重</span>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: '#8c8c8c', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#8c8c8c', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #eee',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
                  }}
                  itemStyle={{ color: '#1a1a1a', fontWeight: 'bold' }}
                  formatter={(v: number) => [`${v.toLocaleString()}万円`]} 
                />
                <Line 
                  type="monotone" 
                  dataKey="toB見込み" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="toC見込み" 
                  stroke="#0891b2" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#0891b2', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="加重合計" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="premium-card p-6 bg-white">
          <h3 className="text-sm font-bold text-[#8c8c8c] uppercase tracking-widest mb-6">担当別 案件数</h3>
          {memberStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#d2d5d9]">
              <p className="text-xs uppercase tracking-tighter font-bold">No Data Available</p>
            </div>
          ) : (
            <div className="space-y-6">
              {memberStats.map(m => (
                <div key={m.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1a1a1a]">{m.name}</span>
                    <span className="text-[10px] text-[#8c8c8c] font-bold">toB:{m.tob} / toC:{m.toc}</span>
                  </div>
                  <div className="relative h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                    <div
                      className="absolute h-full left-0 bg-[#0055ff] rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, (m.tob + m.toc) * 10)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest memo */}
      {latest?.memo && (
        <div className="premium-card p-6 bg-white group">
          <h3 className="text-sm font-bold text-[#8c8c8c] uppercase tracking-widest mb-4 flex items-center gap-2">
            Recent Note <span className="text-[10px] font-mono text-[#d2d5d9]">({latest.log_date})</span>
          </h3>
          <p className="text-base text-[#1a1a1a] leading-relaxed max-w-3xl border-l-[3px] border-[#0055ff] pl-5 font-medium">
            {latest.memo}
          </p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, unit, delta, color }: {
  label: string
  value?: number
  unit: string
  delta: string | null
  color: 'blue' | 'cyan' | 'violet' | 'amber'
}) {
  const accentColor = {
    blue: 'text-[#0055ff]',
    cyan: 'text-[#0891b2]',
    violet: 'text-[#8b5cf6]',
    amber: 'text-[#d97706]',
  }

  const bgHighlight = {
    blue: 'bg-[#f0f7ff]',
    cyan: 'bg-[#ecfdf5]',
    violet: 'bg-[#f5f3ff]',
    amber: 'bg-[#fffbeb]',
  }

  return (
    <div className="premium-card p-6 bg-white hover:border-[#0055ff]/50 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className="text-[10px] font-bold text-[#8c8c8c] uppercase tracking-widest">{label}</div>
        <div className={`w-8 h-8 rounded-lg ${bgHighlight[color]} flex items-center justify-center`}>
          <div className={`w-2 h-2 rounded-full ${accentColor[color].replace('text-', 'bg-')}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <div className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
          {value?.toLocaleString() ?? '-'}
        </div>
        <div className="text-xs font-bold text-[#8c8c8c] uppercase tracking-widest">{unit}</div>
      </div>
      
      {delta && (
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7] flex items-center gap-0.5`}>
            {delta.startsWith('+') ? '↑' : '↓'} {delta.replace('+', '')}
          </span>
          <span className="text-[10px] text-[#8c8c8c] font-bold uppercase tracking-widest">vs Last Week</span>
        </div>
      )}
    </div>
  )
}

