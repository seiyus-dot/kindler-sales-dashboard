'use client'

import { useState } from 'react'
import { supabase, DealToC, Member } from '@/lib/supabase'

type Props = {
  members: Member[]
  initial: DealToC | null
  onClose: () => void
  onSaved: () => void
}

export default function DealToCForm({ members, initial, onClose, onSaved }: Props) {
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
    }
    const { error: err } = initial
      ? await supabase.from('deals_toc').update(payload).eq('id', initial.id)
      : await supabase.from('deals_toc').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-bold">{initial ? 'toC案件 編集' : 'toC案件 新規追加'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          <Field label="担当者" required>
            <select value={form.member_id} onChange={e => set('member_id', e.target.value)} className="input">
              <option value="">選択</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="氏名" required>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="山田 太郎" />
          </Field>

          <Field label="連絡先">
            <input value={form.contact} onChange={e => set('contact', e.target.value)} className="input" placeholder="LINE / 電話 / メール" />
          </Field>
          <Field label="流入経路">
            <input value={form.source} onChange={e => set('source', e.target.value)} className="input" placeholder="広告・紹介・セミナー など" />
          </Field>

          <Field label="ステータス">
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
              <option value="">選択</option>
              {['相談予約','ヒアリング','提案中','クロージング','受注','失注','保留'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="優先度">
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input">
              <option value="">選択</option>
              {['高','中','低'].map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>

          <Field label="初回接触日">
            <input type="date" value={form.first_contact_date} onChange={e => set('first_contact_date', e.target.value)} className="input" />
          </Field>
          <Field label="最終接触日">
            <input type="date" value={form.last_contact_date} onChange={e => set('last_contact_date', e.target.value)} className="input" />
          </Field>

          <Field label="検討サービス">
            <input value={form.service} onChange={e => set('service', e.target.value)} className="input" placeholder="AI CAMP / 個別コンサル など" />
          </Field>
          <Field label="見込み金額（万円）">
            <input type="number" value={form.expected_amount} onChange={e => set('expected_amount', e.target.value)} className="input" placeholder="30" />
          </Field>

          <Field label="受注確度（%）">
            <input type="number" min="0" max="100" value={form.win_probability} onChange={e => set('win_probability', e.target.value)} className="input" placeholder="60" />
          </Field>
          <Field label="次回期日">
            <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} className="input" />
          </Field>

          <div className="col-span-2">
            <Field label="次回アクション">
              <input value={form.next_action} onChange={e => set('next_action', e.target.value)} className="input" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="備考">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input h-20 resize-none" />
            </Field>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm px-6 pb-2">{error}</p>}

        <div className="flex justify-end gap-3 p-6 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">キャンセル</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 font-medium mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">★</span>}
      </label>
      {children}
    </div>
  )
}
