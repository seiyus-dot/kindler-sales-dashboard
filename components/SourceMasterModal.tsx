'use client'

import { useEffect, useState } from 'react'
import { supabase, SourceMaster } from '@/lib/supabase'

type Props = {
  onClose: () => void
}

export default function SourceMasterModal({ onClose }: Props) {
  const [masters, setMasters] = useState<SourceMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [newReg, setNewReg] = useState('')
  const [newSrc, setNewSrc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchMasters() }, [])

  async function fetchMasters() {
    const { data } = await supabase.from('source_master').select('*').order('source').order('registration_source')
    setMasters(data ?? [])
    setLoading(false)
  }

  async function addRow() {
    if (!newReg.trim() || !newSrc.trim()) { setError('両方入力してください'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('source_master').insert({ registration_source: newReg.trim(), source: newSrc.trim() })
    setSaving(false)
    if (err) { setError(err.message); return }
    setNewReg('')
    setNewSrc('')
    fetchMasters()
  }

  async function deleteRow(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('source_master').delete().eq('id', id)
    fetchMasters()
  }

  // 流入経路ごとにグループ化
  const grouped = masters.reduce<Record<string, SourceMaster[]>>((acc, m) => {
    if (!acc[m.source]) acc[m.source] = []
    acc[m.source].push(m)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">流入経路マスタ</h2>
            <p className="text-xs text-gray-400 mt-0.5">登録経路と流入経路（上位）の紐付けを管理します</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
          ) : masters.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">まだ登録がありません</p>
          ) : (
            Object.entries(grouped).map(([src, rows]) => (
              <div key={src}>
                <p className="text-xs font-bold text-gray-500 mb-1.5 px-1">{src}</p>
                <div className="border border-gray-100 rounded overflow-hidden">
                  {rows.map((m, i) => (
                    <div key={m.id} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <span className="text-gray-700 text-xs truncate flex-1 mr-2">{m.registration_source}</span>
                      <button onClick={() => deleteRow(m.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">削除</button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 追加フォーム */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">新規追加</p>
          <div className="flex gap-2">
            <input
              value={newSrc}
              onChange={e => setNewSrc(e.target.value)}
              className="input flex-1"
              placeholder="流入経路（例：Instagram広告）"
            />
            <input
              value={newReg}
              onChange={e => setNewReg(e.target.value)}
              className="input flex-1"
              placeholder="登録経路（例：LP2-3...）"
            />
            <button
              onClick={addRow}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition shrink-0"
            >
              追加
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  )
}
