'use client'

import { useState, useEffect } from 'react'
import { supabase, DealToB, Member, MasterOption } from '@/lib/supabase'

type Props = {
  members: Member[]
  initial: DealToB | null
  onClose: () => void
  onSaved: () => void
}

const TOB_STATUSES = ['アポ取得', '商談中', '提案済', '交渉中', '見積提出', 'リード', '受注', '失注', '保留']
const PRIORITIES = ['高', '中', '低']

export default function DealToBForm({ members, initial, onClose, onSaved }: Props) {
  const [sources, setSources] = useState<MasterOption[]>([])
  const [services, setServices] = useState<MasterOption[]>([])

  const [industries, setIndustries] = useState<MasterOption[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('master_options').select('*').eq('type', 'source').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'service').order('sort_order'),
      supabase.from('master_options').select('*').eq('type', 'industry').order('sort_order'),
    ]).then(([srcRes, svcRes, indRes]) => {
      if (srcRes.data) setSources(srcRes.data)
      if (svcRes.data) setServices(svcRes.data)
      if (indRes.data) setIndustries(indRes.data)
    })
  }, [])

  const [form, setForm] = useState({
    member_id: initial?.member_id ?? '',
    company_name: initial?.company_name ?? '',
    contact_name: initial?.contact_name ?? '',
    industry: initial?.industry ?? '',
    service: initial?.service ?? '',
    status: initial?.status ?? '',
    priority: initial?.priority ?? '',
    first_contact_date: initial?.first_contact_date ?? '',
    last_contact_date: initial?.last_contact_date ?? '',
    expected_amount: initial?.expected_amount?.toString() ?? '',
    win_probability: initial?.win_probability?.toString() ?? '',
    source: initial?.source ?? '',
    next_action: initial?.next_action ?? '',
    next_action_date: initial?.next_action_date ?? '',
    notes: initial?.notes ?? '',
    payment_date: initial?.payment_date ?? '',
    actual_amount: initial?.actual_amount?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  async function handleSubmit() {
    if (!form.member_id || !form.company_name) {
      setError('担当者と企業名は必須です')
      return
    }
    setSaving(true)
    const payload = {
      member_id: form.member_id,
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      industry: form.industry || null,
      service: form.service || null,
      status: form.status || null,
      priority: form.priority || null,
      first_contact_date: form.first_contact_date || null,
      last_contact_date: form.last_contact_date || null,
      expected_amount: form.expected_amount ? parseInt(form.expected_amount) : null,
      win_probability: form.win_probability ? parseInt(form.win_probability) : null,
      source: form.source || null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      notes: form.notes || null,
      payment_date: form.payment_date || null,
      actual_amount: form.actual_amount ? parseInt(form.actual_amount) : null,
    }
    const { error: err } = initial
      ? await supabase.from('deals_tob').update(payload).eq('id', initial.id)
      : await supabase.from('deals_tob').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{initial ? '法人案件を編集' : '法人案件を追加'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-lg">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
          <Field label="担当者" required>
            <select value={form.member_id} onChange={e => set('member_id', e.target.value)} className="input">
              <option value="">選択してください</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="企業名" required>
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="input" placeholder="例：株式会社〇〇" />
          </Field>

          <Field label="先方担当者">
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input" placeholder="例：田中 一郎" />
          </Field>
          <Field label="業種">
            <select value={form.industry} onChange={e => set('industry', e.target.value)} className="input">
              <option value="">-</option>
              {industries.map(i => <option key={i.id}>{i.value}</option>)}
            </select>
          </Field>

          <Field label="商品名">
            <select value={form.service} onChange={e => set('service', e.target.value)} className="input">
              <option value="">-</option>
              {services.map(s => <option key={s.id}>{s.value}</option>)}
            </select>
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
              {TOB_STATUSES.map(s => <option key={s}>{s}</option>)}
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

          <Field label="見込み金額（万円）">
            <input type="number" value={form.expected_amount} onChange={e => set('expected_amount', e.target.value)} className="input font-mono" placeholder="500" />
          </Field>
          <Field label="受注確度（%）">
            <input type="number" min="0" max="100" value={form.win_probability} onChange={e => set('win_probability', e.target.value)} className="input font-mono" placeholder="50" />
          </Field>

          <Field label="次回期日">
            <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} className="input" />
          </Field>
          <Field label="次回アクション">
            <input value={form.next_action} onChange={e => set('next_action', e.target.value)} className="input" placeholder="例：提案書送付" />
          </Field>

          <div className="col-span-2">
            <Field label="備考">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input h-20 resize-none" placeholder="メモを入力" />
            </Field>
          </div>

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

        {error && <p className="mx-6 mb-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">キャンセル</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? '保存中...' : (initial ? '更新する' : '追加する')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">★</span>}
      </label>
      {children}
    </div>
  )
}
