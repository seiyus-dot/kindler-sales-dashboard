'use client'

import { useEffect, useState } from 'react'
import { supabase, WeeklyLog } from '@/lib/supabase'

export default function WeeklyPage() {
  const [logs, setLogs] = useState<WeeklyLog[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    tob_count: '',
    toc_count: '',
    tob_amount: '',
    toc_amount: '',
    weighted_total: '',
    cumulative_orders: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    const { data } = await supabase.from('weekly_logs').select('*').order('log_date', { ascending: false })
    if (data) setLogs(data)
  }

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    if (!form.log_date) { setError('日付は必須です'); return }
    setSaving(true)
    const payload = {
      log_date: form.log_date,
      tob_count: parseInt(form.tob_count) || 0,
      toc_count: parseInt(form.toc_count) || 0,
      tob_amount: parseInt(form.tob_amount) || 0,
      toc_amount: parseInt(form.toc_amount) || 0,
      weighted_total: parseInt(form.weighted_total) || 0,
      cumulative_orders: parseInt(form.cumulative_orders) || 0,
      memo: form.memo || null,
    }
    const { error: err } = await supabase.from('weekly_logs').upsert(payload, { onConflict: 'log_date' })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false)
    fetchLogs()
  }

  async function deleteLog(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('weekly_logs').delete().eq('id', id)
    fetchLogs()
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-white">Weekly Insights</h1>
        <p className="text-white/40 text-sm">Historical performance and strategic logs across all segments.</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-white/40">History</div>
          <div className="text-sm font-mono text-white/20">{logs.length} Records</div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-white text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/90 transition shadow-lg shadow-white/5 active:scale-95 flex items-center gap-2"
        >
          <span className="text-lg">+</span> Log Current Week
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Date</th>
                <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">toB Qty</th>
                <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">toC Qty</th>
                <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">toB Value</th>
                <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">toC Value</th>
                <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Weighted</th>
                <th className="text-right px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Orders</th>
                <th className="text-left px-6 py-4 text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Note</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {logs.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-20 text-white/20 uppercase tracking-widest text-[10px] font-bold">No historical data available</td></tr>
              ) : logs.map((log, i) => (
                <tr key={log.id} className={`hover:bg-white/[0.02] transition-colors group ${i === 0 ? 'bg-blue-500/[0.03]' : ''}`}>
                  <td className="px-6 py-4 font-mono text-blue-400 font-bold">{log.log_date}</td>
                  <td className="px-6 py-4 text-right font-mono text-white/60">{log.tob_count}</td>
                  <td className="px-6 py-4 text-right font-mono text-white/60">{log.toc_count}</td>
                  <td className="px-6 py-4 text-right font-mono text-white/80 font-bold italic">{log.tob_amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-mono text-white/80 font-bold italic">{log.toc_amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-mono text-green-400 font-black tracking-tighter">{log.weighted_total.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-mono text-amber-400 font-bold">{log.cumulative_orders}</td>
                  <td className="px-6 py-4 text-[10px] text-white/30 max-w-xs truncate italic" title={log.memo ?? ''}>{log.memo ?? '-'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteLog(log.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in">
          <div className="glass-card w-full max-w-lg border-white/20 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
              <div className="flex flex-col">
                <h2 className="text-lg font-black tracking-tight text-white uppercase">New Weekly Log</h2>
                <span className="text-[10px] text-white/40 font-bold tracking-[0.2em] uppercase">Metrics Input</span>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6 bg-black/40">
              <div className="col-span-2">
                <label className="block text-[10px] text-white/40 font-black uppercase tracking-widest mb-2">Meeting Date *</label>
                <input type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)} className="input" />
              </div>
              {[
                { key: 'tob_count', label: 'toB Count', icon: '🏢' },
                { key: 'toc_count', label: 'toC Count', icon: '👤' },
                { key: 'tob_amount', label: 'toB Value (万)', icon: '💰' },
                { key: 'toc_amount', label: 'toC Value (万)', icon: '💵' },
                { key: 'weighted_total', label: 'Weighted Sum', icon: '⚖️' },
                { key: 'cumulative_orders', label: 'Total Orders', icon: '🎯' },
              ].map(({ key, label, icon }) => (
                <div key={key}>
                  <label className="block text-[10px] text-white/40 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span>{icon}</span> {label}
                  </label>
                  <input
                    type="number"
                    value={(form as any)[key]}
                    onChange={e => set(key, e.target.value)}
                    className="input font-mono"
                    placeholder="0"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[10px] text-white/40 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>📝</span> Strategy Note
                </label>
                <textarea value={form.memo} onChange={e => set('memo', e.target.value)} className="input h-24 resize-none" placeholder="Enter key meeting takeaways..." />
              </div>
            </div>
            {error && <p className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold mx-6 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex justify-end gap-3 p-6 bg-white/5 border-t border-white/10">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-xs font-bold text-white/40 uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-full hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-600/20 shadow-inner active:scale-95"
              >
                {saving ? 'Saving...' : 'Confirm Log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
