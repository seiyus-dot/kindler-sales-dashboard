'use client'

import { useState } from 'react'
import { Member } from '@/lib/supabase'

type Props = {
  type: 'toB' | 'toC'
  members: Member[]
  onClose: () => void
}

const TOB_RESULTS = ['口頭受注', '正式受注', '見積提出', '保留', '失注'] as const
const TOB_NEXT_STEPS = ['申し込みフォーム送付', '契約書・請求書', 'スケジュール調整', '研修実施'] as const
const TOC_RESULTS = ['口頭受注', '正式受注', '提案継続', '保留', '失注'] as const

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${y}/${parseInt(m)}/${parseInt(d)}`
}

function buildToBMessage(f: ToBForm): string {
  const results = TOB_RESULTS.map(r => `　${f.results.includes(r) ? '✅' : '□'} ${r}`).join('\n')
  const nextSteps = TOB_NEXT_STEPS.map(s => `　${f.nextSteps.includes(s) ? '✅' : '□'} ${s}`).join('\n')
  const extraStep = f.nextStepOther.trim() ? `　✅ ${f.nextStepOther.trim()}` : ''

  return [
    'to B',
    '',
    `■商談：${formatDate(f.date)}`,
    `■担当者：${f.member}`,
    '■お客様',
    `法人名：${f.company}`,
    f.contact ? `担当者名：${f.contact}` : null,
    '■金額',
    f.amountDetail || '（未入力）',
    `■商談結果（該当に✅）：`,
    results,
    '■商談内容：',
    f.content || '（未入力）',
    '■ネクストステップ',
    nextSteps,
    extraStep || null,
  ].filter(l => l !== null).join('\n')
}

function buildToCMessage(f: ToCForm): string {
  const resultText = f.detail.trim()
    ? `${f.result}（${f.detail.trim()}）`
    : f.result

  return [
    'to C',
    '',
    `■商談日：${formatDate(f.date)}`,
    `■担当者：${f.member}`,
    `■お客様名：${f.name}${f.name ? ' 様' : ''}`,
    `■商談結果：${resultText}`,
    `■決済方法：${f.paymentMethod}`,
    f.reason ? `■理由：${f.reason}` : '■理由：',
  ].join('\n')
}

type ToBForm = {
  date: string
  member: string
  company: string
  contact: string
  amountDetail: string
  results: string[]
  content: string
  nextSteps: string[]
  nextStepOther: string
}

type ToCForm = {
  date: string
  member: string
  name: string
  result: string
  detail: string
  paymentMethod: string
  reason: string
}

export default function SalesReportModal({ type, members, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const [toB, setToB] = useState<ToBForm>({
    date: todayStr(),
    member: members[0]?.name ?? '',
    company: '',
    contact: '',
    amountDetail: '',
    results: [],
    content: '',
    nextSteps: [],
    nextStepOther: '',
  })

  const [toC, setToC] = useState<ToCForm>({
    date: todayStr(),
    member: members[0]?.name ?? '',
    name: '',
    result: '保留',
    detail: '',
    paymentMethod: '',
    reason: '',
  })

  const previewText = type === 'toB' ? buildToBMessage(toB) : buildToCMessage(toC)

  function toggleToB<K extends 'results' | 'nextSteps'>(key: K, val: string) {
    setToB(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }))
  }

  async function handleSend() {
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/slack/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: previewText }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error ?? '送信に失敗しました')
        return
      }
      onClose()
    } catch {
      setSendError('通信エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  const inputCls = 'w-full border border-[#e0e6f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const checkItemCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none transition ${
      active ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-[#e0e6f0] text-gray-600 hover:border-blue-200'
    }`

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e0e6f0] flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              売上報告（{type === 'toB' ? '法人' : '個人'}）
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{type === 'toB' ? 'toB / 法人案件' : 'toC / AI CAMP 商談'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">✕</button>
        </div>

        {/* Steps */}
        <div className="px-6 py-2.5 bg-gray-50 border-b border-[#e0e6f0] flex items-center gap-2 text-sm">
          <div className={`flex items-center gap-1.5 font-medium ${step === 1 ? 'text-blue-600' : 'text-green-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
              {step === 1 ? '1' : '✓'}
            </span>
            内容を入力
          </div>
          <span className="text-gray-300">→</span>
          <div className={`flex items-center gap-1.5 font-medium ${step === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
            確認・送信
          </div>
        </div>

        {/* Step 1: Form */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">
            {type === 'toB' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">商談日 <span className="text-red-500">*</span></label>
                    <input type="date" className={inputCls} value={toB.date} onChange={e => setToB(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">担当者 <span className="text-red-500">*</span></label>
                    <select className={inputCls} value={toB.member} onChange={e => setToB(f => ({ ...f, member: e.target.value }))}>
                      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">お客様情報</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">法人名 <span className="text-red-500">*</span></label>
                      <input type="text" className={inputCls} placeholder="例：千代田工務店（鳥取）" value={toB.company} onChange={e => setToB(f => ({ ...f, company: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">先方担当者名</label>
                      <input type="text" className={inputCls} placeholder="例：荒田代表" value={toB.contact} onChange={e => setToB(f => ({ ...f, contact: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">商談内容</p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">金額詳細</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder={"例：AI研修\n4名33万円 基礎\n132万円"}
                      value={toB.amountDetail}
                      onChange={e => setToB(f => ({ ...f, amountDetail: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400 mt-1">商品名・人数・金額などを自由に記載</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">商談結果</label>
                    <div className="flex flex-wrap gap-2">
                      {TOB_RESULTS.map(r => (
                        <button key={r} type="button" className={checkItemCls(toB.results.includes(r))} onClick={() => toggleToB('results', r)}>
                          {toB.results.includes(r) ? '✅' : '□'} {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">商談内容</label>
                    <textarea className={inputCls} rows={2} placeholder="例：集合研修もやってほしい" value={toB.content} onChange={e => setToB(f => ({ ...f, content: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">ネクストステップ</label>
                    <div className="flex flex-wrap gap-2">
                      {TOB_NEXT_STEPS.map(s => (
                        <button key={s} type="button" className={checkItemCls(toB.nextSteps.includes(s))} onClick={() => toggleToB('nextSteps', s)}>
                          {toB.nextSteps.includes(s) ? '✅' : '□'} {s}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className={`${inputCls} mt-2`}
                      placeholder="その他（自由入力）"
                      value={toB.nextStepOther}
                      onChange={e => setToB(f => ({ ...f, nextStepOther: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">商談日 <span className="text-red-500">*</span></label>
                    <input type="date" className={inputCls} value={toC.date} onChange={e => setToC(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">担当者 <span className="text-red-500">*</span></label>
                    <select className={inputCls} value={toC.member} onChange={e => setToC(f => ({ ...f, member: e.target.value }))}>
                      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">お客様情報</p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">お客様名 <span className="text-red-500">*</span></label>
                    <input type="text" className={inputCls} placeholder="例：真狩 正光" value={toC.name} onChange={e => setToC(f => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">商談結果</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">商談結果 <span className="text-red-500">*</span></label>
                      <select className={inputCls} value={toC.result} onChange={e => setToC(f => ({ ...f, result: e.target.value }))}>
                        {TOC_RESULTS.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">決済方法</label>
                      <input type="text" className={inputCls} placeholder="例：クレジットカード" value={toC.paymentMethod} onChange={e => setToC(f => ({ ...f, paymentMethod: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">詳細・補足</label>
                    <input type="text" className={inputCls} placeholder="例：枠がないが少し考える" value={toC.detail} onChange={e => setToC(f => ({ ...f, detail: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">理由・コメント</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="例：奈良でAI案件をやっているが周りに聞く人がいなくて困っている。"
                      value={toC.reason}
                      onChange={e => setToC(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              <span className="text-xs font-semibold text-gray-500">Slackに送信されるメッセージ</span>
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-xl px-5 py-4 text-sm font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {previewText}
            </pre>
            {sendError && (
              <p className="mt-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e0e6f0] bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">キャンセル</button>
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                プレビューを確認 →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep(1); setSendError('') }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">← 修正する</button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {sending ? '送信中...' : 'Slackに送信'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
