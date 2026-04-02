'use client'

import { useState } from 'react'
import { supabase, DealToB, Member } from '@/lib/supabase'

type Props = {
  members: Member[]
  initial: DealToB | null
  onClose: () => void
  onSaved: () => void
}

export default function DealToBForm({ members, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    member_id: initial?.member_id ?? '',
    company_name: initial?.company_name ?? '',
    contact_name: initial?.contact_name ?? '',
    industry: initial?.industry ?? '',
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
    }
    const { error: err } = initial
      ? await supabase.from('deals_tob').update(payload).eq('id', initial.id)
      : await supabase.from('deals_tob').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-gray-200">
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50 text-[#1a1a1a]">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold tracking-tight uppercase">{initial ? 'Edit Corporate Deal' : 'New Corporate Deal'}</h2>
          <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Enterprise Opportunity</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors">✕</button>
      </div>

      <div className="p-8 grid grid-cols-2 gap-6 overflow-y-auto bg-white">
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <Field label="Staff Member" required>
            <select value={form.member_id} onChange={e => set('member_id', e.target.value)} className="input bg-white text-gray-900">
              <option value="">Select Member</option>
              {members.map(m => <option key={m.id} value={m.id} className="text-gray-900">{m.name}</option>)}
            </select>
          </Field>
          <Field label="Company Name" required>
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="input bg-white text-gray-900" placeholder="e.g. Acme Corp" />
          </Field>
        </div>

        <Field label="Contact Person (External)">
          <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input bg-white text-gray-900" placeholder="e.g. John Doe" />
        </Field>
        <Field label="Industry Sector">
          <input value={form.industry} onChange={e => set('industry', e.target.value)} className="input bg-white text-gray-900" placeholder="e.g. Technology" />
        </Field>

        <Field label="Deal Status">
          <select value={form.status} onChange={e => set('status', e.target.value)} className="input bg-white text-gray-900">
            <option value="">Select Status</option>
            {['初回接触','ヒアリング','提案中','見積提出','クロージング','受注','失注','保留'].map(s => (
              <option key={s} className="text-gray-900">{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority Level">
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input bg-white text-gray-900">
            <option value="">Select Priority</option>
            {['高','中','低'].map(p => <option key={p} className="text-gray-900">{p}</option>)}
          </select>
        </Field>

        <Field label="First Contact">
          <input type="date" value={form.first_contact_date} onChange={e => set('first_contact_date', e.target.value)} className="input bg-white text-gray-900" />
        </Field>
        <Field label="Last Activity">
          <input type="date" value={form.last_contact_date} onChange={e => set('last_contact_date', e.target.value)} className="input bg-white text-gray-900" />
        </Field>

        <Field label="Expected Value (10k JPY)">
          <input type="number" value={form.expected_amount} onChange={e => set('expected_amount', e.target.value)} className="input bg-white text-gray-900 font-bold" placeholder="500" />
        </Field>
        <Field label="Win Probability (%)">
          <input type="number" min="0" max="100" value={form.win_probability} onChange={e => set('win_probability', e.target.value)} className="input bg-white text-gray-900 font-bold" placeholder="50" />
        </Field>

        <Field label="Lead Source">
          <input value={form.source} onChange={e => set('source', e.target.value)} className="input bg-white text-gray-900" placeholder="e.g. Referral" />
        </Field>
        <Field label="Next Schedule">
          <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} className="input bg-white text-gray-900" />
        </Field>

        <div className="col-span-2">
          <Field label="Next Strategic Action">
            <input value={form.next_action} onChange={e => set('next_action', e.target.value)} className="input bg-white text-gray-900" placeholder="e.g. Send Proposal" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Internal Memo & Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input h-24 resize-none bg-white text-gray-900" placeholder="Enter details..." />
          </Field>
        </div>
      </div>

      {error && <p className="bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold mx-8 px-3 py-2 rounded-lg my-2">{error}</p>}

      <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t border-gray-100">
        <button onClick={onClose} className="px-6 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-8 py-2 bg-[#0055ff] text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-blue-600 disabled:opacity-50 transition shadow-lg shadow-blue-500/10 active:scale-95"
        >
          {saving ? 'Processing...' : (initial ? 'Sync Updates' : 'Confirm Entry')}
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

