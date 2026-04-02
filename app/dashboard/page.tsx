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
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
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
          color="green"
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
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">週次 見込み金額推移（万円）</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()}万円`} />
              <Legend />
              <Line type="monotone" dataKey="toB見込み" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="toC見込み" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="加重合計" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">担当別 案件数</h3>
          {memberStats.length === 0 ? (
            <p className="text-sm text-gray-400 mt-8 text-center">案件データがありません</p>
          ) : (
            <div className="space-y-3 mt-2">
              {memberStats.map(m => (
                <div key={m.name} className="flex items-center gap-3">
                  <span className="w-14 text-sm text-gray-600 text-right">{m.name}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (m.tob + m.toc) * 10)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-24">toB:{m.tob} / toC:{m.toc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest memo */}
      {latest?.memo && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            最新メモ（{latest.log_date}）
          </h3>
          <p className="text-sm text-gray-700">{latest.memo}</p>
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
  color: 'blue' | 'cyan' | 'green' | 'amber'
}) {
  const colors = {
    blue: 'text-blue-600',
    cyan: 'text-cyan-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
  }
  const borders = {
    blue: 'border-t-blue-500',
    cyan: 'border-t-cyan-500',
    green: 'border-t-green-500',
    amber: 'border-t-amber-500',
  }

  return (
    <div className={`bg-white border border-gray-200 border-t-2 ${borders[color]} rounded-xl p-5`}>
      <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-black font-mono ${colors[color]}`}>
        {value?.toLocaleString() ?? '-'}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
      {delta && (
        <div className="text-xs text-green-500 mt-1 font-mono">{delta} <span className="text-gray-400">前週比</span></div>
      )}
    </div>
  )
}
