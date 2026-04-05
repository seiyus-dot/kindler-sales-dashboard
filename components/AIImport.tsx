'use client'

import { useRef, useState } from 'react'
import { Member } from '@/lib/supabase'

type Props = {
  members: Member[]
  onImported: () => void
}

type PreviewResult = {
  targetTable: string
  targetLabel: string
  reason: string
  mappings: Record<string, string>
  preview: Record<string, unknown>[]
  totalRows: number
  skippedCount: number
  rows: Record<string, unknown>[]
}

export default function AIImport({ members, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [imported, setImported] = useState<{ inserted: number; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function close() {
    setOpen(false)
    setStep('upload')
    setResult(null)
    setImported(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      setLoading(false)
      return
    }

    const headers = Object.keys(rawRows[0])
    const sampleRows = rawRows.slice(0, 5)
    const allRows = rawRows

    const res = await fetch('/api/ai-format-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, sampleRows, allRows, defaultMemberId: memberId || null }),
    })
    const data = await res.json()
    setResult(data)
    setStep('preview')
    setLoading(false)
  }

  async function handleImport() {
    if (!result) return
    setImporting(true)
    const res = await fetch('/api/ai-format-import', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTable: result.targetTable, rows: result.rows }),
    })
    const data = await res.json()
    setImported(data)
    setStep('done')
    setImporting(false)
    if (data.inserted > 0) onImported()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-sm hover:bg-indigo-700 transition"
      >
        AI インポート
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">AI インポート</h2>
            <p className="text-xs text-gray-400 mt-0.5">Excel / CSV を渡すとAIが自動で整形・分類します</p>
          </div>
          <button onClick={close} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* ステップ: アップロード */}
        {step === 'upload' && (
          <div className="p-6 space-y-5">
            <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-sm text-indigo-700">
              Excel（.xlsx）または CSV（.csv）をアップロードすると、AIが列を解析して自動でマッピングします。
              対応テーブル：個人案件 / 法人案件 / AI CAMP商談
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">デフォルト担当者（任意）</label>
              <select value={memberId} onChange={e => setMemberId(e.target.value)} className="input">
                <option value="">未割り当て</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">ファイル（.xlsx / .csv）</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                disabled={loading}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 disabled:opacity-50"
              />
            </div>

            {loading && (
              <div className="text-center py-6 space-y-2">
                <div className="text-sm text-gray-500">AIが列を解析中...</div>
                <div className="flex justify-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ステップ: プレビュー */}
        {step === 'preview' && result && (
          <div className="flex flex-col overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* AI判定結果 */}
              <div className="bg-indigo-50 border border-indigo-100 rounded p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-500 uppercase">インポート先</span>
                  <span className="font-bold text-gray-900">{result.targetLabel}</span>
                </div>
                <p className="text-xs text-indigo-600">{result.reason}</p>
                <p className="text-xs text-gray-500">
                  {result.totalRows}件をインポート
                  {result.skippedCount > 0 && `（${result.skippedCount}件スキップ）`}
                </p>
              </div>

              {/* マッピング表示 */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">列マッピング</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(result.mappings).filter(([, v]) => v && v !== 'null').map(([src, dst]) => (
                    <div key={src} className="flex items-center gap-1.5 text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="text-gray-500 truncate">{src}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-gray-800 font-medium truncate">{dst}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* データプレビュー */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">データプレビュー（最初の5件）</p>
                <div className="overflow-x-auto border border-gray-100 rounded">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {Object.keys(result.preview[0] ?? {}).map(k => (
                          <th key={k} className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.preview.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[150px] truncate">{String(v ?? '-')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setStep('upload'); setResult(null); if (fileRef.current) fileRef.current.value = '' }} className="text-sm text-gray-400 hover:text-gray-600">やり直す</button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {importing ? 'インポート中...' : `${result.totalRows}件をインポートする`}
              </button>
            </div>
          </div>
        )}

        {/* ステップ: 完了 */}
        {step === 'done' && imported && (
          <div className="p-6 space-y-4">
            <div className={`rounded p-4 text-sm ${imported.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="font-bold text-gray-700">{imported.inserted}件をインポートしました</p>
              {imported.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-amber-700">エラー {imported.errors.length}件:</p>
                  {imported.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={close} className="px-4 py-2 text-sm text-white bg-gray-600 rounded hover:bg-gray-700 transition">閉じる</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
