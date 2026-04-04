'use client'

import { useState, useEffect } from 'react'
import { supabase, DealToC, Member, MasterOption, LOSS_REASONS } from '@/lib/supabase'
import DealActions from '@/components/DealActions'

type Props = {
  members: Member[]
  initial: DealToC | null
  onClose: () => void
  onSaved: () => void
}

type Tab = 'info' | 'actions'

const TOC_STATUSES = ['相談予約', 'ヒアリング', '提案中', 'クロージング', '相談済', '受注', '失注', '保留']
const PRIORITIES = ['高', '中', '低']

export default function DealToCForm({ members, initial, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('info')
  const [sources, setSources] = useState<MasterOption[]>([])
  const [services, setServices] = useState<MasterOption[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('master_options').select('*').eq('type', 'source').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'service').order('sort_order'),
    ]).then(([srcRes, svcRes]) => {
      if (srcRes.data) setSources(srcRes.data)
      if (svcRes.data) setServices(svcRes.data)
    })
  }, [])

  const [form, setForm] = useState({
    member_id: initial?.member_id ?? '',
    name: initial?.name ?? '',
    contact: initial?.contact ?? '',
    source: initial?.source ?? '',
    status: initial?.status ?? '',
    priority: initial?.priority ?? '',
    first_contact_date: initial?.first_contact_date ?? '',
    last_contact_date: initial?.last_contact_date ?? '',
    service: initial?.service ?? '',
    expected_amount: initial?.expected_amount?.toString() ?? '',
    win_probability: initial?.win_probability?.toString() ?? '',
    next_action: initial?.next_action ?? '',
    next_action_date: initial?.next_action_date ?? '',
    notes: initial?.notes ?? '',
    payment_date: initial?.payment_date ?? '',
    actual_amount: initial?.actual_amount?.toString() ?? '',
    loss_reason: initial?.loss_reason ?? '',
    loss_detail: initial?.loss_detail ?? '',
    sub_member_id: initial?.sub_member_id ?? '',
    deal_type: initial?.deal_type ?? 'spot',
    monthly_amount: initial?.monthly_amount?.toString() ?? '',
    contract_start: initial?.contract_start ?? '',
    contract_end: initial?.contract_end ?? '',
    payment_status: initial?.payment_status ?? '正常',
    payment_error_date: initial?.payment_error_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  async function handleSubmit() {
    if (!form.member_id || !form.name) {
      setError('担当者と氏名は必須です')
      return
    }
    setSaving(true)
    const payload = {
      member_id: form.member_id,
      name: form.name,
      contact: form.contact || null,
      source: form.source || null,
      status: form.status || null,
      priority: form.priority || null,
      first_contact_date: form.first_contact_date || null,
      last_contact_date: form.last_contact_date || null,
      service: form.service || null,
      expected_amount: form.expected_amount ? parseInt(form.expected_amount) : null,
      win_probability: form.win_probability ? parseInt(form.win_probability) : null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      notes: form.notes || null,
      payment_date: form.payment_date || null,
      actual_amount: form.actual_amount ? parseInt(form.actual_amount) : null,
      loss_reason: form.loss_reason || null,
      loss_detail: form.loss_detail || null,
      sub_member_id: form.sub_member_id || null,
      deal_type: form.deal_type,
      monthly_amount: form.monthly_amount ? parseInt(form.monthly_amount) : null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      payment_status: form.payment_status || null,
      payment_error_date: form.payment_error_date || null,
    }
    const { error: err } = initial
      ? await supabase.from('deals_toc').update(payload).eq('id', initial.id)
      : await supabase.from('deals_toc').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const isLost = form.status === '失注'
  const isSubscription = form.deal_type === 'subscription'
  const dealContext = initial
    ? `個人案件: ${initial.name}（${initial.status ?? ''}）担当: ${initial.member?.name ?? ''}`
    : `個人案件: ${form.name}`

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{initial ? '個人案件を編集' : '個人案件を追加'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-lg">✕</button>
        </div>

        {/* タブ（編集時のみ） */}
        {initial && (
          <div className="flex gap-0 border-b border-gray-100">
            <button
              onClick={() => setTab('info')}
              className={`px-6 py-2.5 text-sm font-medium transition border-b-2 ${tab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              基本情報
            </button>
            <button
              onClick={() => setTab('actions')}
              className={`px-6 py-2.5 text-sm font-medium transition border-b-2 ${tab === 'actions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              アクション履歴
            </button>
          </div>
        )}

        {/* 基本情報タブ */}
        {tab === 'info' && (
          <>
            <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
              <div className="col-span-2">
                <Field label="案件タイプ">
                  <div className="flex gap-2">
                    {(['spot', 'subscription'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('deal_type', t)}
                        className={`px-4 py-1.5 rounded text-sm font-medium transition border ${form.deal_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}
                      >
                        {t === 'spot' ? 'スポット' : 'サブスク'}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="氏名" required>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="例：山田 太郎" />
              </Field>

              <Field label="主担当者" required>
                <select value={form.member_id} onChange={e => set('member_id', e.target.value)} className="input">
                  <option value="">選択してください</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="サブ担当者">
                <select value={form.sub_member_id} onChange={e => set('sub_member_id', e.target.value)} className="input">
                  <option value="">-（なし）</option>
                  {members.filter(m => m.id !== form.member_id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>

              <Field label="連絡先">
                <input value={form.contact} onChange={e => set('contact', e.target.value)} className="input" placeholder="LINE / 電話 / メール" />
              </Field>
              <Field label="流入経路">
                <select value={form.source} onChange={e => set('source', e.target.value)} className="input">
                  <option value="">-</option>
                  {sources.map(s => <option key={s.id}>{s.value}</option>)}
                </select>
              </Field>

              <Field label="ステータス">
                <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
                  <option value="">-</option>
                  {TOC_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="優先度">
                <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input">
                  <option value="">-</option>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="初回接触日">
                <input type="date" value={form.first_contact_date} onChange={e => set('first_contact_date', e.target.value)} className="input" />
              </Field>
              <Field label="最終接触日">
                <input type="date" value={form.last_contact_date} onChange={e => set('last_contact_date', e.target.value)} className="input" />
              </Field>

              <Field label="検討サービス">
                <select value={form.service} onChange={e => set('service', e.target.value)} className="input">
                  <option value="">-</option>
                  {services.map(s => <option key={s.id}>{s.value}</option>)}
                </select>
              </Field>
              <Field label="見込み金額（万円）">
                <input type="number" value={form.expected_amount} onChange={e => set('expected_amount', e.target.value)} className="input font-mono" placeholder="30" />
              </Field>

              <Field label="受注確度（%）">
                <input type="number" min="0" max="100" value={form.win_probability} onChange={e => set('win_probability', e.target.value)} className="input font-mono" placeholder="60" />
              </Field>
              <Field label="次回期日">
                <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} className="input" />
              </Field>

              <div className="col-span-2">
                <Field label="次回アクション">
                  <input value={form.next_action} onChange={e => set('next_action', e.target.value)} className="input" placeholder="例：相談URLを送付" />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="備考">
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input h-20 resize-none" placeholder="メモを入力" />
                </Field>
              </div>

              {/* 失注理由 */}
              {isLost && (
                <div className="col-span-2 border-t border-red-100 pt-4 mt-1 space-y-3">
                  <p className="text-sm font-bold text-red-500">失注理由</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="失注カテゴリ">
                      <select value={form.loss_reason} onChange={e => set('loss_reason', e.target.value)} className="input">
                        <option value="">-</option>
                        {LOSS_REASONS.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </Field>
                    <div className="col-span-2">
                      <Field label="失注詳細">
                        <textarea value={form.loss_detail} onChange={e => set('loss_detail', e.target.value)} className="input h-16 resize-none" placeholder="失注の詳細理由（任意）" />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {isSubscription && (
                <div className="col-span-2 border-t border-blue-100 pt-4 mt-1 space-y-3">
                  <p className="text-xs font-bold text-blue-600">サブスク情報</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="月額（円）">
                      <input type="number" value={form.monthly_amount} onChange={e => set('monthly_amount', e.target.value)} className="input font-mono" placeholder="例：20744" />
                    </Field>
                    <Field label="決済ステータス">
                      <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} className="input">
                        <option value="正常">正常</option>
                        <option value="エラー">エラー</option>
                        <option value="解決済み">解決済み</option>
                      </select>
                    </Field>
                    <Field label="契約開始日">
                      <input type="date" value={form.contract_start} onChange={e => set('contract_start', e.target.value)} className="input" />
                    </Field>
                    <Field label="契約終了日（空欄＝月次更新）">
                      <input type="date" value={form.contract_end} onChange={e => set('contract_end', e.target.value)} className="input" />
                    </Field>
                    {form.payment_status === 'エラー' && (
                      <Field label="エラー発生日">
                        <input type="date" value={form.payment_error_date} onChange={e => set('payment_error_date', e.target.value)} className="input" />
                      </Field>
                    )}
                  </div>
                </div>
              )}

              <div className="col-span-2 border-t border-green-100 pt-4 mt-1">
                <p className="text-xs font-bold text-green-600 mb-3">着金情報</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="着金日">
                    <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="input" />
                  </Field>
                  <Field label="着金額（万円）">
                    <input type="number" value={form.actual_amount} onChange={e => set('actual_amount', e.target.value)} className="input font-mono" placeholder="実際の入金額" />
                  </Field>
                </div>
              </div>
            </div>

            {error && <p className="mx-6 mb-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">キャンセル</button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? '保存中...' : (initial ? '更新する' : '追加する')}
              </button>
            </div>
          </>
        )}

        {/* アクション履歴タブ */}
        {tab === 'actions' && initial && (
          <div className="p-6 overflow-y-auto flex-1">
            <DealActions
              dealId={initial.id}
              dealType="toc"
              dealContext={dealContext}
              isLost={initial.status === '失注'}
              currentLossReason={initial.loss_reason}
              currentLossDetail={initial.loss_detail}
              members={members}
              defaultMemberId={initial.member_id}
              onLossSaved={onSaved}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
