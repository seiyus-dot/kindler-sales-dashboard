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
  duplicateCount: number
  rows: Record<string, unknown>[]
}

const TEMPLATES = [
  {
    key: 'aicamp',
    label: 'AI CAMP 商談',
    filename: 'template_aicamp_consultations.csv',
    headers: ['LINE名', '氏名', '年齢', '実施日(YYYY-MM-DD)', '担当者名', '流入経路', '登録経路', 'ステータス', '着金額(円)', '支払方法', '顧客属性', '動機', '理由', '返事期限(YYYY-MM-DD)', '議事録URL', '職業', '月収', 'AI経験'],
    example: ['みき', '石渡 美希', '48', '2026-03-18', '白岩 聖悠', '', '（LP2-3）', '成約', '150000', '銀行振込', '', '', '', '', '', '事務', '41～50万円', '業務や日常で少し使っている'],
  },
  {
    key: 'toc',
    label: '個人案件',
    filename: 'template_deals_toc.csv',
    headers: ['氏名', 'メール・電話', '商品名', 'ステータス', '流入経路', '見込み金額(万円)', '着金額(万円)', '着金日(YYYY-MM-DD)', '初回接触日(YYYY-MM-DD)', '担当者名', 'メモ'],
    example: ['山田 太郎', 'example@mail.com', 'AI CAMP', '商談中', 'SNS', '43', '', '', '2026-04-01', '白岩 聖悠', ''],
  },
  {
    key: 'tob',
    label: '法人案件',
    filename: 'template_deals_tob.csv',
    headers: ['企業名', '担当者名', '商品名', '業種', 'ステータス', '流入経路', '見込み金額(万円)', '着金額(万円)', '担当メンバー名', 'メモ'],
    example: ['株式会社サンプル', '鈴木 一郎', 'AI研修', 'IT', '提案中', '紹介', '50', '', '白岩 聖悠', ''],
  },
]

function downloadTemplate(t: typeof TEMPLATES[0]) {
  const bom = '\uFEFF' // UTF-8 BOM（Excel で文字化けしないように）
  const rows = [t.headers.join(','), t.example.map(v => `"${v}"`).join(',')]
  const csv = bom + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = t.filename
  a.click()
  URL.revokeObjectURL(url)
}

function parseText(text: string, hasHeader: boolean): Record<string, unknown>[] {
  // クォート内の改行を含む TSV/CSV に対応した本格パーサー
  const delimiter = text.split('\n')[0].includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { currentField += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if (ch === '\n' && !inQuotes) {
      currentRow.push(currentField.trim())
      if (currentRow.some(f => f.length > 0)) rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else if (ch === '\r') {
      // skip
    } else {
      currentField += ch
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(f => f.length > 0)) rows.push(currentRow)
  }

  if (rows.length === 0) return []
  const headers = hasHeader
    ? rows[0].map(h => h.replace(/^"|"$/g, ''))
    : rows[0].map((_, i) => `列${i + 1}`)
  const dataRows = hasHeader ? rows.slice(1) : rows
  return dataRows.map(values => {
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

export default function AIImport({ members, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [inputMode, setInputMode] = useState<'file' | 'text'>('text')
  const [pasteText, setPasteText] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
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
    setPasteText('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function analyzeRows(rawRows: Record<string, unknown>[]) {
    if (rawRows.length === 0) { setLoading(false); return }
    try {
      const headers = Object.keys(rawRows[0])
      const res = await fetch('/api/ai-format-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          sampleRows: rawRows.slice(0, 5),
          allRows: rawRows,
          defaultMemberId: memberId || null,
          members: members.map(m => ({ id: m.id, name: m.name })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(`エラー: ${data.error ?? res.statusText}`)
        setLoading(false)
        return
      }
      setResult(data)
      setStep('preview')
    } catch (e) {
      alert(`エラー: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const buffer = await file.arrayBuffer()

    if (file.name.toLowerCase().endsWith('.csv')) {
      // CSV: UTF-8 BOM → UTF-8、それ以外は Shift-JIS を試みて失敗したら UTF-8
      const bytes = new Uint8Array(buffer)
      const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
      let text: string
      if (hasUtf8Bom) {
        text = new TextDecoder('utf-8').decode(buffer)
      } else {
        try {
          text = new TextDecoder('shift-jis').decode(buffer)
        } catch {
          text = new TextDecoder('utf-8').decode(buffer)
        }
      }
      await analyzeRows(parseText(text, hasHeader))
      return
    }

    // Excel (.xlsx / .xls)
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    await analyzeRows(rawRows)
  }

  async function handlePaste() {
    if (!pasteText.trim()) return
    setLoading(true)
    try {
      await analyzeRows(parseText(pasteText, hasHeader))
    } catch (e) {
      alert(`エラー: ${String(e)}`)
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!result) return
    setImporting(true)
    try {
      const res = await fetch('/api/ai-format-import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTable: result.targetTable, rows: result.rows }),
      })
      const data = await res.json()
      setImported(data)
      setStep('done')
      if (data.inserted > 0) onImported()
    } catch (e) {
      alert(`インポートエラー: ${String(e)}`)
    } finally {
      setImporting(false)
    }
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
          <div className="p-6 space-y-4">
            {/* テンプレダウンロード */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">テンプレ:</span>
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={() => downloadTemplate(t)} className="text-xs text-indigo-500 hover:underline">
                  {t.label}
                </button>
              ))}
            </div>
            {/* モード切り替え */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded text-sm">
              {(['text', 'file'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className={`flex-1 py-1.5 rounded font-medium transition ${inputMode === mode ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  {mode === 'text' ? 'テキスト貼り付け' : 'ファイル（Excel / CSV）'}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500">デフォルト担当者（任意）</label>
              <select value={memberId} onChange={e => setMemberId(e.target.value)} className="input">
                <option value="">未割り当て（データ内の担当者名を自動照合）</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {inputMode === 'text' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-500">
                    データを貼り付け（スプレッドシートからコピー、またはCSV/TSVテキスト）
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={e => setHasHeader(e.target.checked)}
                      className="rounded"
                    />
                    1行目はヘッダー
                  </label>
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  className="input h-40 resize-none font-mono text-xs"
                  placeholder={'列名1\t列名2\t列名3\n値1\t値2\t値3\n...'}
                  disabled={loading}
                />
                <button
                  onClick={handlePaste}
                  disabled={loading || !pasteText.trim()}
                  className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {loading ? 'AIが解析中...' : '解析する'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">ファイル（.xlsx / .xls / .csv）</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  disabled={loading}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 disabled:opacity-50"
                />
              </div>
            )}

            {loading && (
              <div className="text-center py-4 space-y-2">
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
                {result.duplicateCount > 0 && (
                  <p className="text-xs font-semibold text-amber-600">
                    重複の可能性: {result.duplicateCount}件（既存データと名前が一致）— インポートすると二重登録になります
                  </p>
                )}
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
                        {Object.keys(result.preview[0] ?? {}).filter(k => k !== '_isDuplicate').map(k => (
                          <th key={k} className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.preview.map((row, i) => (
                        <tr key={i} className={`border-b ${row._isDuplicate ? 'bg-amber-50' : 'border-gray-50'}`}>
                          {Object.entries(row).filter(([k]) => k !== '_isDuplicate').map(([k, v]) => (
                            <td key={k} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[150px] truncate">{String(v ?? '-')}</td>
                          ))}
                          {row._isDuplicate && (
                            <td className="px-2 py-1.5 text-amber-600 text-xs font-semibold whitespace-nowrap">重複?</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setStep('upload'); setResult(null); setPasteText(''); if (fileRef.current) fileRef.current.value = '' }} className="text-sm text-gray-400 hover:text-gray-600">やり直す</button>
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
