'use client'

import { useState, useEffect } from 'react'
import { supabase, AICampConsultation, Member, SourceMaster, CONSULTATION_STATUSES, PAYMENT_METHODS, AI_EXPERIENCES } from '@/lib/supabase'

type Props = {
  members: Member[]
  initial: AICampConsultation | null
  onClose: () => void
  onSaved: () => void
}

const MONTHLY_INCOMES = ['〜10万円', '11～20万円', '21～30万円', '31～40万円', '41～50万円', '51～60万円', '61～70万円', '71～80万円', '81～90万円', '91～100万円', '101万円以上']

export default function AICampConsultationForm({ members, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    line_name: initial?.line_name ?? '',
    name: initial?.name ?? '',
    age: initial?.age?.toString() ?? '',
    consultation_date: initial?.consultation_date ? initial.consultation_date.slice(0, 16) : '',
    member_id: initial?.member_id ?? '',
    source: initial?.source ?? '',
    registration_source: initial?.registration_source ?? '',
    status: initial?.status ?? '予定',
    contract_amount: initial?.contract_amount?.toString() ?? '',
    payment_amount: initial?.payment_amount?.toString() ?? '',
    payment_date: initial?.payment_date ?? '',
    payment_method: initial?.payment_method ?? '',
    customer_attribute: initial?.customer_attribute ?? '',
    motivation: initial?.motivation ?? '',
    reason: initial?.reason ?? '',
    reply_deadline: initial?.reply_deadline ?? '',
    minutes_url: initial?.minutes_url ?? '',
    occupation: initial?.occupation ?? '',
    monthly_income: initial?.monthly_income ?? '',
    ai_experience: initial?.ai_experience ?? '',
    ai_purpose: initial?.ai_purpose ?? '',
    expectation: initial?.expectation ?? '',
    question: initial?.question ?? '',
    service_type: initial?.service_type ?? 'AI CAMP',
  })
  const [sourceMasters, setSourceMasters] = useState<SourceMaster[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('source_master').select('*').order('source').order('registration_source')
      .then(({ data }) => setSourceMasters(data ?? []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleRegistrationSourceChange(val: string) {
    const master = sourceMasters.find(m => m.registration_source === val)
    setForm(f => ({
      ...f,
      registration_source: val,
      source: master ? master.source : f.source,
    }))
  }

  // 流入経路ごとにグループ化
  const groupedMasters = sourceMasters.reduce<Record<string, SourceMaster[]>>((acc, m) => {
    if (!acc[m.source]) acc[m.source] = []
    acc[m.source].push(m)
    return acc
  }, {})

  const isContracted = form.status === '成約'

  async function handleSubmit() {
    setSaving(true)
    const payload = {
      line_name: form.line_name || null,
      name: form.name || null,
      age: form.age ? parseInt(form.age) : null,
      consultation_date: form.consultation_date || null,
      member_id: form.member_id || null,
      source: form.source || null,
      registration_source: form.registration_source || null,
      status: form.status,
      contract_amount: form.contract_amount ? parseInt(form.contract_amount) : null,
      payment_amount: form.payment_amount ? parseInt(form.payment_amount) : null,
      payment_date: form.payment_date || null,
      payment_method: form.payment_method || null,
      customer_attribute: form.customer_attribute || null,
      motivation: form.motivation || null,
      reason: form.reason || null,
      reply_deadline: form.reply_deadline || null,
      minutes_url: form.minutes_url || null,
      occupation: form.occupation || null,
      monthly_income: form.monthly_income || null,
      ai_experience: form.ai_experience || null,
      ai_purpose: form.ai_purpose || null,
      expectation: form.expectation || null,
      question: form.question || null,
      service_type: form.service_type,
    }
    const { error: err } = initial
      ? await supabase.from('aicamp_consultations').update(payload).eq('id', initial.id)
      : await supabase.from('aicamp_consultations').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{initial ? '商談を編集' : '商談を追加'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
          {/* 基本情報 */}
          <Field label="実施日時">
            <input type="datetime-local" value={form.consultation_date} onChange={e => set('consultation_date', e.target.value)} className="input" />
          </Field>
          <Field label="担当者">
            <select value={form.member_id} onChange={e => set('member_id', e.target.value)} className="input">
              <option value="">選択してください</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Field label="LINE名">
            <input value={form.line_name} onChange={e => set('line_name', e.target.value)} className="input" placeholder="例：松岡 毅" />
          </Field>
          <Field label="お名前">
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="例：松岡 毅" />
          </Field>

          <Field label="年齢">
            <input type="number" value={form.age} onChange={e => set('age', e.target.value)} className="input font-mono" placeholder="44" />
          </Field>
          <Field label="サービス区分">
            <select value={form.service_type} onChange={e => set('service_type', e.target.value)} className="input">
              <option>AI CAMP</option>
              <option>プロダクト AI CAMP</option>
            </select>
          </Field>
          <Field label="ステータス">
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
              {CONSULTATION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="登録経路">
            <select
              value={form.registration_source}
              onChange={e => handleRegistrationSourceChange(e.target.value)}
              className="input"
            >
              <option value="">選択してください</option>
              {Object.entries(groupedMasters).map(([src, rows]) => (
                <optgroup key={src} label={src}>
                  {rows.map(m => (
                    <option key={m.id} value={m.registration_source}>{m.registration_source}</option>
                  ))}
                </optgroup>
              ))}
              <option value="__other__">その他（直接入力）</option>
            </select>
            {(form.registration_source === '__other__' || (form.registration_source && !sourceMasters.find(m => m.registration_source === form.registration_source))) && (
              <input
                value={form.registration_source === '__other__' ? '' : form.registration_source}
                onChange={e => set('registration_source', e.target.value)}
                className="input mt-1"
                placeholder="登録経路を入力"
              />
            )}
          </Field>
          <Field label="流入経路">
            <input value={form.source} onChange={e => set('source', e.target.value)} className="input" placeholder="登録経路を選択すると自動入力" />
          </Field>

          {/* 成約情報 */}
          {isContracted && (
            <>
              <Field label="契約金額（円）">
                <input type="number" value={form.contract_amount} onChange={e => set('contract_amount', e.target.value)} className="input font-mono" placeholder="200000" />
              </Field>
              <Field label="着金額（円）">
                <input type="number" value={form.payment_amount} onChange={e => set('payment_amount', e.target.value)} className="input font-mono" placeholder="200000" />
              </Field>
              <Field label="着金日">
                <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className="input" />
              </Field>
              <Field label="支払い方法">
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="input">
                  <option value="">-</option>
                  {PAYMENT_METHODS.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </>
          )}

          <Field label="返事の期限">
            <input type="date" value={form.reply_deadline} onChange={e => set('reply_deadline', e.target.value)} className="input" />
          </Field>
          <Field label="顧客属性">
            <input value={form.customer_attribute} onChange={e => set('customer_attribute', e.target.value)} className="input" placeholder="例：会社の社員に受講させたい" />
          </Field>

          {/* 顧客属性 */}
          <Field label="ご職業">
            <input value={form.occupation} onChange={e => set('occupation', e.target.value)} className="input" placeholder="例：IT" />
          </Field>
          <Field label="現在の月収">
            <select value={form.monthly_income} onChange={e => set('monthly_income', e.target.value)} className="input">
              <option value="">-</option>
              {MONTHLY_INCOMES.map(i => <option key={i}>{i}</option>)}
            </select>
          </Field>

          <div className="col-span-2">
            <Field label="AIの知識・経験">
              <select value={form.ai_experience} onChange={e => set('ai_experience', e.target.value)} className="input">
                <option value="">-</option>
                {AI_EXPERIENCES.map(e => <option key={e}>{e}</option>)}
              </select>
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="議事録URL">
              <input value={form.minutes_url} onChange={e => set('minutes_url', e.target.value)} className="input" placeholder="https://youtu.be/..." />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="成約/失注/保留の理由">
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} className="input h-20 resize-none" placeholder="理由を記入" />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="動機・背景">
              <textarea value={form.motivation} onChange={e => set('motivation', e.target.value)} className="input h-20 resize-none" placeholder="ロードマップ作成会への動機" />
            </Field>
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
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  )
}
