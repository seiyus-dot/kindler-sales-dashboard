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
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Weekly Insights</h1>
        <p className="text-[#8c8c8c] text-sm font-medium">Historical performance and strategic logs across all segments.</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-500">History</div>
          <div className="text-sm font-bold text-gray-300">{logs.length} Records</div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#1a1a1a] text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition shadow-sm active:scale-95"
        >
          Log Current Week
        </button>
      </div>

      <div className="premium-card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Date</th>
                <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">toB Qty</th>
                <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">toC Qty</th>
                <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">toB Value</th>
                <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">toC Value</th>
                <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Weighted</th>
                <th className="text-right px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Orders</th>
                <th className="text-left px-6 py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Note</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-20 text-gray-300 uppercase tracking-widest text-[10px] font-bold italic">No historical data available</td></tr>
              ) : logs.map((log, i) => (
                <tr key={log.id} className={`hover:bg-gray-50/50 transition-colors group ${i === 0 ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-6 py-4 font-bold text-[#0055ff]">{log.log_date}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-500">{log.tob_count}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-500">{log.toc_count}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900 italic">{log.tob_amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900 italic">{log.toc_amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-bold text-[#16a34a]">{log.weighted_total.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-bold text-[#d97706]">{log.cumulative_orders}</td>
                  <td className="px-6 py-4 text-[11px] text-gray-400 max-w-xs truncate font-medium" title={log.memo ?? ''}>{log.memo ?? '-'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteLog(log.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest text-red-500">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in">
          <div className="premium-card w-full max-w-lg bg-white border-gray-200 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-col">
                <h2 className="text-lg font-bold tracking-tight text-[#1a1a1a] uppercase">New Weekly Log</h2>
                <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Metrics Input</span>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6 bg-white">
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Meeting Date *</label>
                <input type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)} className="input" />
              </div>
              {[
                { key: 'tob_count', label: 'toB Count' },
                { key: 'toc_count', label: 'toC Count' },
                { key: 'tob_amount', label: 'toB Value (万)' },
                { key: 'toc_amount', label: 'toC Value (万)' },
                { key: 'weighted_total', label: 'Weighted Sum' },
                { key: 'cumulative_orders', label: 'Total Orders' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                    {label}
                  </label>
                  <input
                    type="number"
                    value={(form as any)[key]}
                    onChange={e => set(key, e.target.value)}
                    className="input"
                    placeholder="0"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                  Strategy Note
                </label>
                <textarea value={form.memo} onChange={e => set('memo', e.target.value)} className="input h-24 resize-none" placeholder="Enter key meeting takeaways..." />
              </div>
            </div>
            {error && <p className="bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold mx-6 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2 bg-[#0055ff] text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-blue-600 disabled:opacity-50 transition shadow-lg shadow-blue-500/10 active:scale-95"
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
