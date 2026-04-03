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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">週次ログ</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + 今週のログを記録
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">日付</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">法人 件数</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">個人 件数</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">法人 見込み(万)</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">個人 見込み(万)</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">期待売上見込み(万)</th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">累計受注数</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">メモ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">ログがありません</td></tr>
            ) : logs.map((log, i) => (
              <tr key={log.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === 0 ? 'font-semibold' : ''}`}>
                <td className="px-4 py-3 text-blue-600">{log.log_date}</td>
                <td className="px-4 py-3 text-right font-mono">{log.tob_count}</td>
                <td className="px-4 py-3 text-right font-mono">{log.toc_count}</td>
                <td className="px-4 py-3 text-right font-mono">{log.tob_amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{log.toc_amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-green-600">{log.weighted_total.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{log.cumulative_orders}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{log.memo ?? '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteLog(log.id)} className="text-xs text-red-400 hover:underline">削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-bold">週次ログ記録</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 font-medium mb-1">会議日 *</label>
                <input type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)} className="input w-full" />
              </div>
              {[
                { key: 'tob_count', label: '法人 件数' },
                { key: 'toc_count', label: '個人 件数' },
                { key: 'tob_amount', label: '法人 見込み（万円）' },
                { key: 'toc_amount', label: '個人 見込み（万円）' },
                { key: 'weighted_total', label: '期待売上見込み（万円）' },
                { key: 'cumulative_orders', label: '累計受注数' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 font-medium mb-1">{label}</label>
                  <input
                    type="number"
                    value={(form as any)[key]}
                    onChange={e => set(key, e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 font-medium mb-1">会議メモ</label>
                <textarea value={form.memo} onChange={e => set('memo', e.target.value)} className="input w-full h-20 resize-none" />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm px-6 pb-2">{error}</p>}
            <div className="flex justify-end gap-3 p-6 pt-2 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">キャンセル</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? '保存中...' : '記録する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
