'use client'

import { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'
import {
  supabase,
  Contract,
  ContractStatus,
  CONTRACT_STATUSES,
  CONTRACT_TRAINING_UNIT,
  CONTRACT_ADVISOR_UNIT,
} from '@/lib/supabase'

type Props = {
  contract: Contract
  onClose: () => void
  onChanged: () => void
}

function fmt(n: number) {
  return '¥' + n.toLocaleString('ja-JP')
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${y}年${m}月${d}日`
}

function fmtDateTime(s: string) {
  const dt = new Date(s)
  return dt.toLocaleString('ja-JP')
}

export default function ContractDetailModal({ contract, onClose, onChanged }: Props) {
  const [status, setStatus] = useState<ContractStatus>(contract.status)
  const [copied, setCopied] = useState(false)
  const [updating, setUpdating] = useState(false)

  async function updateStatus(next: ContractStatus) {
    if (next === status) return
    setUpdating(true)
    const { error } = await supabase
      .from('contracts')
      .update({ status: next })
      .eq('id', contract.id)
    setUpdating(false)
    if (error) {
      alert('ステータス更新に失敗しました: ' + error.message)
      return
    }
    setStatus(next)
    onChanged()
  }

  async function copyJson() {
    const json = JSON.stringify(
      {
        client_name: contract.client_name,
        sales_rep: contract.members?.name ?? null,
        contract_type: contract.contract_type,
        advisor_months: contract.advisor_months,
        start_date: contract.start_date,
        lines: (contract.contract_items ?? []).map(i => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal_tax_excl: i.subtotal_tax_excl,
        })),
        total_tax_excl: contract.total_tax_excl,
        tax_amount: contract.tax_amount,
        total_tax_inc: contract.total_tax_inc,
        status,
        submitted_at: contract.submitted_at,
      },
      null,
      2,
    )
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      alert('クリップボードへのコピーに失敗しました')
    }
  }

  const unit = contract.contract_type === 'training' ? CONTRACT_TRAINING_UNIT : CONTRACT_ADVISOR_UNIT
  const items = (contract.contract_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  const typeLabel = contract.contract_type === 'training' ? 'AI研修（コース）' : 'AI顧問'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">{contract.client_name}</h2>
            <p className="text-[11px] text-slate-400 mt-1">
              {typeLabel}
              {contract.members?.name ? `　|　担当: ${contract.members.name}` : ''}
              　|　{fmtDateTime(contract.submitted_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="text-left font-bold px-3 py-2">内訳明細</th>
                <th className="text-center font-bold px-3 py-2">数量</th>
                <th className="text-right font-bold px-3 py-2">単価（税別）</th>
                <th className="text-right font-bold px-3 py-2">小計（税別）</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-2.5">{item.name}</td>
                  <td className="px-3 py-2.5 text-center">
                    {item.quantity}
                    {contract.contract_type === 'training' ? '名' : 'ヶ月'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {fmt(item.unit_price || unit)}（税別）
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {fmt(item.subtotal_tax_excl)}（税別）
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-slate-50 rounded-lg px-4 py-3.5">
            <div className="flex justify-between text-xs py-0.5">
              <span>{contract.contract_type === 'training' ? '研修' : '顧問'}開始予定日</span>
              <span className="font-bold">{fmtDate(contract.start_date)}</span>
            </div>
            <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-xs py-0.5">
              <span>税別本体価格</span><span>{fmt(contract.total_tax_excl)}</span>
            </div>
            <div className="flex justify-between text-xs py-0.5">
              <span>消費税額（10%）</span><span>{fmt(contract.tax_amount)}</span>
            </div>
            <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
              <span className="text-xs font-bold text-blue-600">総合計（契約金額・税込）</span>
              <span className="text-base font-bold text-blue-600">{fmt(contract.total_tax_inc)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">ステータス変更</label>
            <select
              className="input"
              value={status}
              onChange={e => updateStatus(e.target.value as ContractStatus)}
              disabled={updating}
            >
              {CONTRACT_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={copyJson}
            className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${
              copied ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {copied ? (
              <>
                <Check size={13} />
                コピーしました
              </>
            ) : (
              <>
                <Copy size={13} />
                契約書生成データをコピー（JSON）
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
