'use client'

import { useEffect, useState } from 'react'
import { supabase, DealAction, Member, ACTION_TYPES, LOSS_REASONS } from '@/lib/supabase'

type Props = {
  dealId: string
  dealType: 'tob' | 'toc'
  dealContext: string
  isLost: boolean
  currentLossReason?: string
  currentLossDetail?: string
  members: Member[]
  defaultMemberId?: string
  onLossSaved?: () => void
}

type ExtractResult = {
  category: string
  detail: string
  insights: string[]
}

export default function DealActions({
  dealId, dealType, dealContext, isLost,
  currentLossReason, currentLossDetail,
  members, defaultMemberId, onLossSaved,
}: Props) {
  const [actions, setActions] = useState<DealAction[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    action_type: '',
    action_date: new Date().toISOString().slice(0, 10),
    notes: '',
    member_id: defaultMemberId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // 失注分析
  const [showExtract, setShowExtract] = useState(false)
  const [extractNotes, setExtractNotes] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractResult | null>(null)
  const [savingLoss, setSavingLoss] = useState(false)
  const [lossSaved, setLossSaved] = useState(false)

  useEffect(() => { fetchActions() }, [dealId])

  async function fetchActions() {
    const { data, error } = await supabase
      .from('deal_actions')
      .select('*, member:members!member_id(name)')
      .eq('deal_id', dealId)
      .order('action_date', { ascending: false })
    if (error) console.error('fetchActions error:', error)
    setActions(data ?? [])
  }

  async function addAction() {
    if (!form.action_type || !form.action_date) return
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('deal_actions').insert({
      deal_id: dealId,
      deal_type: dealType,
      action_type: form.action_type,
      action_date: form.action_date,
      notes: form.notes || null,
      member_id: form.member_id || null,
    })
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setShowForm(false)
    setForm({ action_type: '', action_date: new Date().toISOString().slice(0, 10), notes: '', member_id: defaultMemberId ?? '' })
    fetchActions()
  }

  async function deleteAction(id: string) {
    if (!confirm('削除しますか？')) return
    await supabase.from('deal_actions').delete().eq('id', id)
    fetchActions()
  }

  async function extractLossReason() {
    if (!extractNotes.trim()) return
    setExtracting(true)
    setExtracted(null)
    try {
      const res = await fetch('/api/extract-loss-reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: extractNotes, dealContext }),
      })
      const data = await res.json()
      setExtracted(data)
    } catch {
      setExtracted({ category: 'その他', detail: '抽出に失敗しました', insights: [] })
    }
    setExtracting(false)
  }

  async function saveLossReason() {
    if (!extracted) return
    setSavingLoss(true)
    const table = dealType === 'tob' ? 'deals_tob' : 'deals_toc'
    await supabase.from(table).update({
      loss_reason: extracted.category,
      loss_detail: extracted.detail,
    }).eq('id', dealId)
    // アクション履歴にも記録
    await supabase.from('deal_actions').insert({
      deal_id: dealId,
      deal_type: dealType,
      action_type: 'その他',
      action_date: new Date().toISOString().slice(0, 10),
      notes: `【失注分析】${extracted.category}：${extracted.detail}`,
      member_id: defaultMemberId || null,
    })
    setSavingLoss(false)
    setLossSaved(true)
    setShowExtract(false)
    setExtracted(null)
    setExtractNotes('')
    fetchActions()
    onLossSaved?.()
  }

  const actionTypeColor = (type: string) => {
    switch (type) {
      case '初回接触': return 'bg-purple-100 text-purple-700'
      case '商談':     return 'bg-blue-100 text-blue-700'
      case '提案':     return 'bg-indigo-100 text-indigo-700'
      case '見積提出': return 'bg-cyan-100 text-cyan-700'
      case 'クロージング': return 'bg-orange-100 text-orange-700'
      case 'フォロー': return 'bg-gray-100 text-gray-600'
      default:         return 'bg-gray-100 text-gray-500'
    }
  }

  return (
    <div className="space-y-4">
      {/* 失注分析パネル */}
      {isLost && (
        <div className="border border-red-100 rounded bg-red-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-red-600">失注分析</p>
            {!showExtract && (
              <button
                onClick={() => setShowExtract(true)}
                className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-100 transition"
              >
                議事録から分析
              </button>
            )}
          </div>
          {(currentLossReason || lossSaved) && !showExtract && (
            <div className="text-sm text-red-700 space-y-0.5">
              <p><span className="font-bold">理由:</span> {currentLossReason}</p>
              {currentLossDetail && <p className="text-red-500 text-xs">{currentLossDetail}</p>}
            </div>
          )}
          {!currentLossReason && !lossSaved && !showExtract && (
            <p className="text-xs text-red-400">失注理由が未記録です</p>
          )}

          {showExtract && (
            <div className="space-y-3 mt-2">
              <textarea
                value={extractNotes}
                onChange={e => setExtractNotes(e.target.value)}
                className="w-full border border-red-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white h-28 resize-none"
                placeholder="議事録・商談メモ・会話内容などを貼り付けてください"
              />
              <div className="flex gap-2">
                <button
                  onClick={extractLossReason}
                  disabled={extracting || !extractNotes.trim()}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {extracting ? 'AI分析中...' : 'AIで失注理由を抽出'}
                </button>
                <button onClick={() => { setShowExtract(false); setExtracted(null) }} className="text-xs text-gray-400 hover:text-gray-600">
                  キャンセル
                </button>
              </div>

              {extracted && (
                <div className="bg-white border border-red-200 rounded p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">失注カテゴリ</p>
                    <span className="inline-block bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded">
                      {extracted.category}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">失注理由</p>
                    <p className="text-sm text-gray-700">{extracted.detail}</p>
                  </div>
                  {extracted.insights?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1">改善アクション案</p>
                      <ul className="space-y-1">
                        {extracted.insights.map((ins, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                            <span className="text-blue-400 flex-shrink-0">•</span>
                            {ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={saveLossReason}
                    disabled={savingLoss}
                    className="w-full py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {savingLoss ? '保存中...' : 'この内容で失注理由を保存'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* アクション追加ボタン */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          アクション履歴 {actions.length > 0 && `（${actions.length}件）`}
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition"
          >
            + アクション追加
          </button>
        )}
      </div>

      {/* アクション追加フォーム */}
      {showForm && (
        <div className="border border-blue-100 rounded bg-blue-50/40 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">アクション種別 *</label>
              <select
                value={form.action_type}
                onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">選択</option>
                {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">実施日 *</label>
              <input
                type="date"
                value={form.action_date}
                onChange={e => setForm(f => ({ ...f, action_date: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">担当者</label>
            <select
              value={form.member_id}
              onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">-</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">メモ・議事録</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 h-20 resize-none"
              placeholder="商談内容・メモなどを記録"
            />
          </div>
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          <div className="flex gap-2">
            <button
              onClick={addAction}
              disabled={saving || !form.action_type || !form.action_date}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? '保存中...' : '記録する'}
            </button>
            <button onClick={() => { setShowForm(false); setSaveError('') }} className="text-xs text-gray-400 hover:text-gray-600">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* アクション一覧 */}
      {actions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">アクション記録がありません</p>
      ) : (
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={a.id} className="flex gap-3 group">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-blue-300 mt-1.5 flex-shrink-0" />
                {i < actions.length - 1 && <div className="w-0.5 bg-gray-100 flex-1 mt-1" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${actionTypeColor(a.action_type)}`}>
                      {a.action_type}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{a.action_date}</span>
                    {a.member?.name && (
                      <span className="text-xs text-gray-400">{a.member?.name}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteAction(a.id)}
                    className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                  >
                    削除
                  </button>
                </div>
                {a.notes && (
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{a.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
