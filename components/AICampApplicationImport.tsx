'use client'

import { useRef, useState } from 'react'
import { Member } from '@/lib/supabase'

type Props = {
  members: Member[]
  onImported: () => void
}

type Result = { inserted: number; skipped: number; errors: string[] }

export default function AICampApplicationImport({ members, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    const csv = await file.text()
    const res = await fetch('/api/import-aicamp-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, defaultMemberId: memberId || null }),
    })
    const data: Result = await res.json()
    setResult(data)
    setLoading(false)
    if (data.inserted > 0) onImported()
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-sm hover:bg-gray-50 transition"
      >
        申込CSV インポート
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">AI CAMP 申込CSV インポート</h2>
          <button onClick={() => { setOpen(false); setResult(null) }} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-blue-700">
            Google スプレッドシート → ファイル → ダウンロード → カンマ区切り形式(.csv) で取得したファイルをアップロードしてください。<br />
            「テスト」「テスト太郎」は自動でスキップされます。
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">デフォルト担当者（任意）</label>
            <select value={memberId} onChange={e => setMemberId(e.target.value)} className="input">
              <option value="">未割り当て</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">CSV ファイル</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              disabled={loading}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
          </div>

          {loading && <p className="text-sm text-gray-500 text-center py-2">インポート中...</p>}

          {result && (
            <div className={`rounded p-4 text-sm space-y-1 ${result.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="font-semibold text-gray-700">
                追加 {result.inserted}件 / スキップ {result.skipped}件
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-amber-700">エラー ({result.errors.length}件):</p>
                  {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={() => { setOpen(false); setResult(null) }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">閉じる</button>
        </div>
      </div>
    </div>
  )
}
