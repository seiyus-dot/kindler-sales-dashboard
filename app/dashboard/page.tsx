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
        <h1 className="text-3xl font-black tracking-tight text-white">Sales Analytics</h1>
        <p className="text-white/40 text-sm">Real-time overview of your sales pipeline and performance.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          label="toB 見込み金額"
          value={latest?.tob_amount}
          unit="万円"
          delta={delta(latest?.tob_amount, prev?.tob_amount)}
          color="blue"
          icon="🏢"
        />
        <KpiCard
          label="toC 見込み金額"
          value={latest?.toc_amount}
          unit="万円"
          delta={delta(latest?.toc_amount, prev?.toc_amount)}
          color="cyan"
          icon="👤"
        />
        <KpiCard
          label="加重パイプライン"
          value={latest?.weighted_total}
          unit="万円"
          delta={delta(latest?.weighted_total, prev?.weighted_total)}
          color="violet"
          icon="⚖️"
        />
        <KpiCard
          label="累計受注数"
          value={latest?.cumulative_orders}
          unit="件"
          delta={delta(latest?.cumulative_orders, prev?.cumulative_orders)}
          color="amber"
          icon="🎯"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">週次 見込み金額推移（万円）</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-blue-500" /> toB</span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-cyan-400" /> toC</span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-violet-500" /> 加重</span>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    backdropFilter: 'blur(10px)'
                  }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: number) => [`${v.toLocaleString()}万円`]} 
                />
                <Line 
                  type="monotone" 
                  dataKey="toB見込み" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#000' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="toC見込み" 
                  stroke="#22d3ee" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#22d3ee', strokeWidth: 2, stroke: '#000' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="加重合計" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#000' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-6">担当別 案件数</h3>
          {memberStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/20">
              <span className="text-4xl mb-2">📁</span>
              <p className="text-xs uppercase tracking-tighter">No Data Available</p>
            </div>
          ) : (
            <div className="space-y-6">
              {memberStats.map(m => (
                <div key={m.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white/80">{m.name}</span>
                    <span className="text-[10px] text-white/40 font-mono italic">toB:{m.tob} / toC:{m.toc}</span>
                  </div>
                  <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full left-0 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-1000"
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
        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="text-6xl">📝</span>
          </div>
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
            Recent Note <span className="text-[10px] font-mono text-white/20">({latest.log_date})</span>
          </h3>
          <p className="text-base text-white/80 leading-relaxed max-w-3xl border-l-2 border-blue-500/30 pl-4">
            {latest.memo}
          </p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, unit, delta, color, icon }: {
  label: string
  value?: number
  unit: string
  delta: string | null
  color: 'blue' | 'cyan' | 'violet' | 'amber'
  icon: string
}) {
  const colorStyles = {
    blue: 'from-blue-500/20 to-transparent text-blue-400 border-blue-500/20 shadow-blue-500/5',
    cyan: 'from-cyan-400/20 to-transparent text-cyan-300 border-cyan-400/20 shadow-cyan-400/5',
    violet: 'from-violet-500/20 to-transparent text-violet-400 border-violet-500/20 shadow-violet-500/5',
    amber: 'from-amber-400/20 to-transparent text-amber-300 border-amber-400/20 shadow-amber-400/5',
  }

  const iconBg = {
    blue: 'bg-blue-500/10 text-blue-500',
    cyan: 'bg-cyan-400/10 text-cyan-400',
    violet: 'bg-violet-500/10 text-violet-500',
    amber: 'bg-amber-400/10 text-amber-400',
  }

  return (
    <div className={`glass-card p-6 overflow-hidden relative group hover:border-white/20 transition-all duration-300 shadow-xl ${colorStyles[color]}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{label}</div>
        <div className={`w-8 h-8 rounded-lg ${iconBg[color]} flex items-center justify-center text-sm shadow-inner group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <div className="text-4xl font-black tracking-tighter text-white font-mono leading-none">
          {value?.toLocaleString() ?? '-'}
        </div>
        <div className="text-xs font-bold text-white/30 uppercase tracking-widest">{unit}</div>
      </div>
      
      {delta && (
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 flex items-center gap-0.5`}>
            {delta.startsWith('+') ? '↑' : '↓'} {delta.replace('+', '')}
          </span>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">vs Last Week</span>
        </div>
      )}

      {/* Decorative gradient */}
      <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br opacity-10 blur-3xl rounded-full ${colorStyles[color]}`} />
    </div>
  )
}
