'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import {
  supabase,
  Member,
  ContractType,
  CONTRACT_TRAINING_UNIT,
  CONTRACT_ADVISOR_UNIT,
  CONTRACT_TRAINING_COURSES,
} from '@/lib/supabase'

type Props = {
  members: Member[]
  onSubmitted: () => void
}

type TrainingRow = { name: string; quantity: string }

const ADVISOR_MONTH_OPTIONS = [1, 2, 3, 6, 12, 24]

function fmt(n: number) {
  return '¥' + n.toLocaleString('ja-JP')
}

export default function ContractForm({ members, onSubmitted }: Props) {
  const [clientName, setClientName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [contractType, setContractType] = useState<ContractType | ''>('')
  const [trainingRows, setTrainingRows] = useState<TrainingRow[]>([
    { name: CONTRACT_TRAINING_COURSES[0], quantity: '' },
  ])
  const [trainingStartDate, setTrainingStartDate] = useState('')
  const [advisorMonths, setAdvisorMonths] = useState('')
  const [advisorStartDate, setAdvisorStartDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function selectType(t: ContractType) {
    setContractType(t)
    setError('')
  }

  function addRow() {
    setTrainingRows(rows => [
      ...rows,
      { name: CONTRACT_TRAINING_COURSES[0], quantity: '' },
    ])
  }
  function removeRow(idx: number) {
    setTrainingRows(rows => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)))
  }
  function updateRow(idx: number, patch: Partial<TrainingRow>) {
    setTrainingRows(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  type CalcLine = { name: string; quantity: number; unitPrice: number; subExcl: number }
  type CalcResult = { lines: CalcLine[]; taxExcl: number; taxAmt: number; total: number } | null

  function calcData(): CalcResult {
    if (!contractType) return null
    if (contractType === 'training') {
      const lines: CalcLine[] = []
      let taxExcl = 0
      for (const row of trainingRows) {
        const q = parseInt(row.quantity) || 0
        if (q <= 0) continue
        const subExcl = q * CONTRACT_TRAINING_UNIT
        taxExcl += subExcl
        lines.push({
          name: row.name,
          quantity: q,
          unitPrice: CONTRACT_TRAINING_UNIT,
          subExcl,
        })
      }
      if (!lines.length) return null
      const taxAmt = Math.floor(taxExcl * 0.1)
      return { lines, taxExcl, taxAmt, total: taxExcl + taxAmt }
    }
    const m = parseInt(advisorMonths) || 0
    if (!m) return null
    const subExcl = m * CONTRACT_ADVISOR_UNIT
    const taxAmt = Math.floor(subExcl * 0.1)
    return {
      lines: [{
        name: `AI顧問 ${m}ヶ月`,
        quantity: m,
        unitPrice: CONTRACT_ADVISOR_UNIT,
        subExcl,
      }],
      taxExcl: subExcl,
      taxAmt,
      total: subExcl + taxAmt,
    }
  }

  const calc = calcData()

  async function handleSubmit() {
    setError('')
    if (!clientName.trim()) { setError('クライアント企業名を入力してください'); return }
    if (!contractType) { setError('契約種別を選択してください'); return }
    if (!calc) { setError('契約内容を入力してください'); return }
    const startDate = contractType === 'training' ? trainingStartDate : advisorStartDate
    if (!startDate) { setError('開始予定日を選択してください'); return }

    setSaving(true)
    const { data: inserted, error: insErr } = await supabase
      .from('contracts')
      .insert({
        client_name: clientName.trim(),
        member_id: memberId || null,
        contract_type: contractType,
        advisor_months: contractType === 'advisor' ? parseInt(advisorMonths) : null,
        start_date: startDate,
        total_tax_excl: calc.taxExcl,
        tax_amount: calc.taxAmt,
        total_tax_inc: calc.total,
        status: '新規受付（未対応）',
      })
      .select('id')
      .single()

    if (insErr || !inserted) {
      setSaving(false)
      setError(insErr?.message ?? '保存に失敗しました')
      return
    }

    const itemsPayload = calc.lines.map((l, i) => ({
      contract_id: inserted.id,
      sort_order: i,
      name: l.name,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      subtotal_tax_excl: l.subExcl,
    }))
    const { error: itemErr } = await supabase.from('contract_items').insert(itemsPayload)

    setSaving(false)
    if (itemErr) {
      await supabase.from('contracts').delete().eq('id', inserted.id)
      setError('明細の保存に失敗しました: ' + itemErr.message)
      return
    }

    resetForm()
    onSubmitted()
  }

  function resetForm() {
    setClientName('')
    setMemberId('')
    setContractType('')
    setTrainingRows([{ name: CONTRACT_TRAINING_COURSES[0], quantity: '' }])
    setTrainingStartDate('')
    setAdvisorMonths('')
    setAdvisorStartDate('')
    setError('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900">契約情報入力</h2>
        <p className="text-xs text-slate-500 mt-1">商談成約後、必要事項を入力してCSへ送信してください</p>
      </div>

      {/* 基本情報 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-4">基本情報</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              クライアント企業名 <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="例：株式会社〇〇"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">正式な法人名称（前株・後株に注意）</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">担当営業</label>
            <select className="input" value={memberId} onChange={e => setMemberId(e.target.value)}>
              <option value="">選択してください</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            契約種別 <span className="text-red-500">*</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <TypeRadio
              selected={contractType === 'training'}
              onClick={() => selectType('training')}
              title="AI 研修（コース）"
              desc="¥300,000 / 名（税別）"
            />
            <TypeRadio
              selected={contractType === 'advisor'}
              onClick={() => selectType('advisor')}
              title="AI 顧問"
              desc="¥200,000 / 月（税別）"
            />
          </div>
        </div>
      </section>

      {/* 契約内容 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-4">契約内容</h3>

        {!contractType && (
          <p className="text-center text-xs text-slate-400 py-3">契約種別を選択すると入力項目が表示されます</p>
        )}

        {contractType === 'training' && (
          <div className="space-y-3">
            <div className="space-y-2">
              {trainingRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center bg-slate-50 rounded-lg p-2.5">
                  <select
                    className="input flex-1"
                    value={row.name}
                    onChange={e => updateRow(i, { name: e.target.value })}
                  >
                    {CONTRACT_TRAINING_COURSES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    className="input w-32 text-right"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="受講人数"
                    value={row.quantity}
                    onChange={e => updateRow(i, { quantity: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={trainingRows.length <= 1}
                    title="削除"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-dashed border-blue-500 text-blue-600 rounded-md text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              <Plus size={12} />
              コースを追加する
            </button>
            <div className="max-w-xs pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                研修開始予定日 <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                type="date"
                value={trainingStartDate}
                onChange={e => setTrainingStartDate(e.target.value)}
              />
              <p className="text-[11px] text-slate-400 mt-1">研修の初回実施予定日を選択してください</p>
            </div>
          </div>
        )}

        {contractType === 'advisor' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                契約期間 <span className="text-red-500">*</span>
              </label>
              <select className="input" value={advisorMonths} onChange={e => setAdvisorMonths(e.target.value)}>
                <option value="">選択してください</option>
                {ADVISOR_MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}ヶ月</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                顧問開始予定日 <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                type="date"
                value={advisorStartDate}
                onChange={e => setAdvisorStartDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* 金額確認 */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
            金額確認（リアルタイム自動計算）
          </h3>
        </div>
        <div className="px-4 pb-4">
          <div className="bg-slate-900 text-white rounded-xl p-5">
            {!calc ? (
              <div className="text-center text-slate-400 text-xs py-1.5">
                契約内容を入力すると金額が自動計算されます
              </div>
            ) : (
              <>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  金額内訳（自動計算）
                </div>
                {calc.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-300 py-0.5">
                    <span>{l.name}</span>
                    <span>{fmt(l.subExcl)}（税別）</span>
                  </div>
                ))}
                <hr className="border-white/10 my-2.5" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">総合計（税込）</span>
                  <span className="text-2xl font-bold">{fmt(calc.total)}</span>
                </div>
                <div className="mt-3 bg-white/5 rounded-lg px-3.5 py-2.5">
                  <div className="flex justify-between text-[11px] text-slate-300 py-0.5">
                    <span>税別本体価格</span><span>{fmt(calc.taxExcl)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-300 py-0.5">
                    <span>消費税額（10%）</span><span>{fmt(calc.taxAmt)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? '送信中…' : '申請してCSへ送信する'}
      </button>
    </div>
  )
}

function TypeRadio({ selected, onClick, title, desc }: { selected: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-3.5 rounded-lg border-[1.5px] transition-colors text-left ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/60'
      }`}
    >
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>
      </div>
    </button>
  )
}
