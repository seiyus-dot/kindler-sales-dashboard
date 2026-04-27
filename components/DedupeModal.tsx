'use client'

import { useState } from 'react'
import type { AICampConsultation } from '@/lib/supabase'

type DuplicatePair = {
  recordA: AICampConsultation
  recordB: AICampConsultation
  reason: string
  confidence: 'high' | 'medium'
}

type Step = 'detecting' | 'review' | 'merging'

type Props = {
  records: AICampConsultation[]
  onMergeComplete: () => void
}

const FIELD_LABELS: Partial<Record<keyof AICampConsultation, string>> = {
  name: '氏名',
  line_name: 'LINE名',
  age: '年齢',
  consultation_date: '実施日',
  status: 'ステータス',
  payment_amount: '着金額',
  payment_date: '着金日',
  source: '流入経路',
  registration_source: '登録経路',
  occupation: '職業',
  monthly_income: '月収',
  ai_experience: 'AI経験',
  motivation: '動機',
  reason: '理由',
  service_type: 'サービス',
}

function getPairKey(p: DuplicatePair) {
  return [p.recordA.id, p.recordB.id].sort().join('::')
}

// ── DuplicatePairCard ─────────────────────────────────────────────────────────

type CardProps = {
  pair: DuplicatePair
  onMerge: (keepId: string, deleteId: string) => void
  onSkip: () => void
  disabled: boolean
}

function DuplicatePairCard({ pair, onMerge, onSkip, disabled }: CardProps) {
  const [keepSide, setKeepSide] = useState<'A' | 'B'>('A')

  const keepRecord = keepSide === 'A' ? pair.recordA : pair.recordB
  const deleteRecord = keepSide === 'A' ? pair.recordB : pair.recordA

  const diffFields = (Object.keys(FIELD_LABELS) as (keyof AICampConsultation)[]).filter(key => {
    const va = String(pair.recordA[key] ?? '')
    const vb = String(pair.recordB[key] ?? '')
    return va !== vb
  })

  return (
    <div className={`border rounded-lg overflow-hidden ${pair.confidence === 'high' ? 'border-orange-300' : 'border-gray-200'}`}>
      {/* カードヘッダー */}
      <div className={`px-4 py-2 flex items-center justify-between gap-2 ${pair.confidence === 'high' ? 'bg-orange-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {pair.confidence === 'high'
            ? <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium shrink-0">高信頼度</span>
            : <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-medium shrink-0">中信頼度</span>
          }
          <p className="text-xs text-gray-600 truncate">{pair.reason}</p>
        </div>
        <button onClick={onSkip} disabled={disabled} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 disabled:opacity-40">スキップ</button>
      </div>

      {/* 2カラム比較 */}
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        {(['A', 'B'] as const).map(side => {
          const record = side === 'A' ? pair.recordA : pair.recordB
          const isKeep = keepSide === side
          return (
            <div key={side} className={`p-4 space-y-1.5 ${isKeep ? 'bg-blue-50/40' : ''}`}>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="radio"
                  name={`keep-${getPairKey(pair)}`}
                  checked={isKeep}
                  onChange={() => setKeepSide(side)}
                  disabled={disabled}
                />
                <span className={`text-xs font-semibold ${isKeep ? 'text-blue-700' : 'text-gray-500'}`}>
                  {isKeep ? '★ こちらを残す' : 'こちらを残す'}
                </span>
              </label>
              {(Object.keys(FIELD_LABELS) as (keyof AICampConsultation)[]).map(key => {
                const val = record[key]
                const isDiff = diffFields.includes(key)
                if (!val && !isDiff) return null
                return (
                  <div
                    key={String(key)}
                    className={`text-xs rounded px-2 py-1 ${isDiff ? 'bg-yellow-50 border border-yellow-200' : ''}`}
                  >
                    <span className="text-gray-400 mr-1">{FIELD_LABELS[key]}:</span>
                    <span className={`text-gray-800 ${isDiff ? 'font-medium' : ''}`}>
                      {val != null && val !== '' ? String(val) : <span className="text-gray-300">—</span>}
                    </span>
                  </div>
                )
              })}
              <p className="text-xs text-gray-300 pt-1">登録: {record.created_at?.slice(0, 10)}</p>
            </div>
          )
        })}
      </div>

      {/* アクションフッター */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">ラジオボタンで残すレコードを選択してください</p>
        <button
          onClick={() => onMerge(keepRecord.id, deleteRecord.id)}
          disabled={disabled}
          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded transition font-medium disabled:opacity-40 shrink-0"
        >
          統合する
        </button>
      </div>
    </div>
  )
}

// ── DedupeModal ───────────────────────────────────────────────────────────────

export default function DedupeModal({ records, onMergeComplete }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('detecting')
  const [pairs, setPairs] = useState<DuplicatePair[]>([])
  const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set())
  const [mergedCount, setMergedCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  async function startDetect() {
    setOpen(true)
    setStep('detecting')
    setPairs([])
    setSkippedKeys(new Set())
    setMergedCount(0)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/ai-dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? res.statusText)
      setPairs(data.pairs ?? [])
    } catch (e) {
      setErrorMsg(String(e))
    } finally {
      setStep('review')
    }
  }

  function skipPair(key: string) {
    setSkippedKeys(prev => new Set([...prev, key]))
  }

  async function mergePair(keepId: string, deleteId: string, pairKey: string) {
    if (!confirm('この2件を統合しますか？この操作は元に戻せません。')) return
    setIsMerging(true)
    try {
      const res = await fetch('/api/ai-dedupe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId, deleteId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? res.statusText)
      setPairs(prev => prev.filter(p => getPairKey(p) !== pairKey))
      setMergedCount(prev => prev + 1)
    } catch (e) {
      alert(`統合エラー: ${String(e)}`)
    } finally {
      setIsMerging(false)
    }
  }

  function close() {
    setOpen(false)
    if (mergedCount > 0) onMergeComplete()
  }

  const activePairs = pairs.filter(p => !skippedKeys.has(getPairKey(p)))

  return (
    <>
      <button
        onClick={startDetect}
        className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm text-orange-600 border border-orange-200 rounded-sm hover:bg-orange-50 transition whitespace-nowrap"
      >
        重複を検出
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 pb-8 overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-lg z-10">
              <div>
                <h2 className="text-base font-bold text-gray-800">重複レコードの検出・統合</h2>
                <p className="text-xs text-gray-400 mt-0.5">AIが名前のゆれ・空欄差異などから同一人物を検出します</p>
              </div>
              <button onClick={close} disabled={isMerging} className="text-gray-400 hover:text-gray-600 text-xl leading-none disabled:opacity-40">✕</button>
            </div>

            {/* detecting */}
            {step === 'detecting' && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">AIが重複を検出中... ({records.length}件を分析)</p>
              </div>
            )}

            {/* review */}
            {step === 'review' && (
              <div className="p-6 space-y-4">
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
                    エラーが発生しました: {errorMsg}
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-gray-700">
                    {activePairs.length === 0
                      ? pairs.length === 0 ? '重複は検出されませんでした。' : 'すべての重複を処理しました。'
                      : `${activePairs.length}件の重複候補が見つかりました。`}
                  </p>
                  {mergedCount > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {mergedCount}件統合済み
                    </span>
                  )}
                  {isMerging && (
                    <span className="text-xs text-orange-500 flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
                      統合中...
                    </span>
                  )}
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {activePairs.map(pair => {
                    const key = getPairKey(pair)
                    return (
                      <DuplicatePairCard
                        key={key}
                        pair={pair}
                        onMerge={(keepId, deleteId) => mergePair(keepId, deleteId, key)}
                        onSkip={() => skipPair(key)}
                        disabled={isMerging}
                      />
                    )
                  })}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button
                    onClick={close}
                    disabled={isMerging}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    {mergedCount > 0 ? '完了・閉じる' : '閉じる'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
