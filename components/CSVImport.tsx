'use client'

import { useState, useRef } from 'react'
import { Member, MasterOption } from '@/lib/supabase'

type Tab = 'tob' | 'toc'
type ParsedRow = Record<string, string>
type MappedRow = Record<string, string | number | null> & { member_name?: string; _error?: string }

const TOB_COLUMNS: Record<string, string> = {
  '企業名': 'company_name', '担当者名': 'member_name', '業種': 'industry',
  'ステータス': 'status', '優先度': 'priority',
  '初回接触日': 'first_contact_date', '最終接触日': 'last_contact_date',
  '見込み金額（万円）': 'expected_amount', '見込み金額': 'expected_amount',
  '受注確度': 'win_probability', '流入経路': 'source',
  '次回アクション': 'next_action', '次回期日': 'next_action_date',
  '備考': 'notes', '商品名': 'service', '先方担当者': 'contact_name',
}

const TOC_COLUMNS: Record<string, string> = {
  '氏名': 'name', '担当者名': 'member_name', '連絡先': 'contact',
  '流入経路': 'source', 'ステータス': 'status', '優先度': 'priority',
  '初回接触日': 'first_contact_date', '最終接触日': 'last_contact_date',
  '検討サービス': 'service', '見込み金額（万円）': 'expected_amount', '見込み金額': 'expected_amount',
  '受注確度': 'win_probability', '次回アクション': 'next_action',
  '次回期日': 'next_action_date', '備考': 'notes',
}

function parseDate(val: string): string | null {
  if (!val?.trim()) return null
  const full = val.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (full) return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`
  const short = val.match(/^(\d{1,2})月(\d{1,2})日$/)
  if (short) return `2026-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim()
  return null
}

function parseAmount(val: string): number | null {
  if (!val?.trim()) return null
  const n = parseInt(val.replace(/[万円,\s]/g, ''))
  return isNaN(n) ? null : n
}

function parseProbability(val: string): number | null {
  if (!val?.trim()) return null
  const n = parseInt(val.replace('%', '').trim())
  return isNaN(n) ? null : n
}

function parseCSV(text: string): ParsedRow[] {
  const sep = text.includes('\t') ? '\t' : ','
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(sep).map(h => h.replace(/^["'\r]+|["'\r]+$/g, '').trim())

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"' && !inQ) { inQ = true; continue }
      if (ch === '"' && inQ) { inQ = false; continue }
      if (ch === sep && !inQ) { values.push(cur.trim()); cur = ''; continue }
      if (ch === '\r') continue
      cur += ch
    }
    values.push(cur.trim())
    const row: ParsedRow = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

type Props = {
  tab: Tab
  members: Member[]
  sources: MasterOption[]
  onImported: () => void
}

export default function CSVImport({ tab, members, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rows, setRows] = useState<MappedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // 同じファイルを再選択できるようにリセット
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      const colMap = tab === 'tob' ? TOB_COLUMNS : TOC_COLUMNS

      const mapped: MappedRow[] = parsed.map(row => {
        const result: MappedRow = {}
        Object.entries(row).forEach(([header, val]) => {
          const field = colMap[header]
          if (!field) return
          if (field === 'expected_amount') result.expected_amount = parseAmount(val)
          else if (field === 'win_probability') result.win_probability = parseProbability(val)
          else if (['first_contact_date', 'last_contact_date', 'next_action_date'].includes(field))
            result[field] = parseDate(val)
          else result[field] = val || null
        })

        const member = members.find(m => m.name === result.member_name)
        if (member) result.member_id = member.id
        else if (result.member_name) result._error = `担当者「${result.member_name}」が見つかりません`

        const key = tab === 'tob' ? 'company_name' : 'name'
        if (!result[key]) result._error = (result._error ? result._error + '・' : '') + '必須項目が空です'

        return result
      })

      setRows(mapped)
      setStep(2)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleImport() {
    setImporting(true)
    const count = rows.filter(r => !r._error).length
    setImportedCount(count)
    setImporting(false)
    setStep(3)
    onImported()
  }

  function reset() {
    setOpen(false); setStep(1); setRows([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const validCount = rows.filter(r => !r._error).length
  const errorCount = rows.length - validCount

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
      >
        CSVインポート
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  CSVインポート — {tab === 'tob' ? '法人案件' : '個人案件'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">ステップ {step} / 3</p>
              </div>
              <button onClick={reset} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {step === 1 && (
                <div className="space-y-5">
                  <label
                    htmlFor="csv-file-input"
                    className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition block"
                  >
                    <p className="text-sm font-medium text-gray-600 mb-1">ファイルをクリックして選択</p>
                    <p className="text-xs text-gray-400">CSV・TSV（タブ区切り）・TXT に対応</p>
                    <input
                      id="csv-file-input"
                      ref={fileRef}
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleFile}
                      className="hidden"
                    />
                  </label>

                  <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-2">
                    <p className="font-semibold text-gray-600">対応カラム名：</p>
                    <p>{tab === 'tob'
                      ? '企業名*・担当者名・業種・ステータス・優先度・初回接触日・最終接触日・見込み金額（万円）・受注確度・流入経路・次回アクション・次回期日・備考・商品名'
                      : '氏名*・担当者名・連絡先・流入経路・ステータス・優先度・初回接触日・最終接触日・検討サービス・見込み金額（万円）・受注確度・次回アクション・次回期日・備考'
                    }</p>
                    <p className="text-gray-400">*は必須。日付は「2026年3月31日」「4月6日」「2026-03-31」いずれも対応。金額は「万円」付きでも可。スプレッドシートからそのままコピペして保存したTSVファイルも対応。</p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">{validCount} 件インポート可能</span>
                    {errorCount > 0 && <span className="text-red-500 font-medium">{errorCount} 件エラー（スキップ）</span>}
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">状態</th>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">
                            {tab === 'tob' ? '企業名' : '氏名'}
                          </th>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">担当者</th>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">ステータス</th>
                          <th className="px-3 py-2 text-right text-gray-400 font-semibold whitespace-nowrap">見込み</th>
                          <th className="px-3 py-2 text-right text-gray-400 font-semibold whitespace-nowrap">確度</th>
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">次回期日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${row._error ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row._error
                                ? <span className="text-red-500">{row._error}</span>
                                : <span className="text-green-500 font-bold">OK</span>}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {String(tab === 'tob' ? row.company_name : row.name) || '-'}
                            </td>
                            <td className="px-3 py-2">{String(row.member_name || '-')}</td>
                            <td className="px-3 py-2">{String(row.status || '-')}</td>
                            <td className="px-3 py-2 text-right font-mono">{row.expected_amount ?? '-'}</td>
                            <td className="px-3 py-2 text-right font-mono">{row.win_probability ?? '-'}</td>
                            <td className="px-3 py-2">{String(row.next_action_date || '-')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-center py-10 space-y-2">
                  <p className="text-5xl font-black text-blue-600 font-mono">{importedCount}</p>
                  <p className="text-gray-700 font-medium">件をインポートしました</p>
                  {errorCount > 0 && <p className="text-xs text-gray-400">{errorCount} 件はエラーのためスキップされました</p>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              {step === 2 && (
                <>
                  <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">戻る</button>
                  <button
                    onClick={handleImport}
                    disabled={importing || validCount === 0}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {importing ? 'インポート中...' : `${validCount} 件をインポート`}
                  </button>
                </>
              )}
              {step === 3 && (
                <button onClick={reset} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                  閉じる
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
