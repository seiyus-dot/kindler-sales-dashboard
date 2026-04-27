'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { ProductAICampSession } from '@/lib/supabase'
import { DEMO_PRODUCT_SESSIONS } from '@/lib/demoData'

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

export default function ProductAICampApplyPage() {
  const [sessions, setSessions] = useState<ProductAICampSession[]>([])
  const [form, setForm] = useState({ name: '', phone: '', email: '', session_id: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError] = useState<string | null>(null)

  useEffect(() => {
    setSessions(DEMO_PRODUCT_SESSIONS)
  }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())    e.name       = 'お名前を入力してください'
    if (!form.phone.trim())   e.phone      = '電話番号を入力してください'
    if (!form.email.trim())   e.email      = 'メールアドレスを入力してください'
    if (!form.session_id)     e.session_id = '参加希望日を選択してください'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = () => {
    if (!validate()) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-12 max-w-md w-full">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-6" />
          <h2 className="text-xl font-bold text-slate-800 mb-3">申し込みが完了しました</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            ご登録いただいた内容を確認の上、<br />
            担当者よりご連絡差し上げます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Product AI CAMP</h1>
          <p className="text-sm text-slate-500 mt-2">申し込みフォーム</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-5">
          <div>
            <FieldLabel label="お名前" required />
            <input
              className="input"
              placeholder="例：山田 太郎"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <FieldLabel label="電話番号" required />
            <input
              className="input"
              type="tel"
              placeholder="例：090-1234-5678"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div>
            <FieldLabel label="メールアドレス" required />
            <input
              className="input"
              type="email"
              placeholder="例：yamada@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <FieldLabel label="参加希望日" required />
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400 mt-1">現在募集中の開催日はありません</p>
            ) : (
              <div className="space-y-2 mt-1">
                {sessions.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                      form.session_id === s.id
                        ? 'border-navy/40 bg-navy/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      form.session_id === s.id ? 'border-navy' : 'border-slate-300'
                    }`}>
                      {form.session_id === s.id && (
                        <div className="w-2 h-2 rounded-full bg-navy" />
                      )}
                    </div>
                    <input
                      type="radio"
                      name="session"
                      value={s.id}
                      checked={form.session_id === s.id}
                      onChange={() => setForm(f => ({ ...f, session_id: s.id }))}
                      className="sr-only"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">{s.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {s.session_date} 〜 {s.end_date}
                        {s.max_capacity ? `　定員 ${s.max_capacity}名` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {errors.session_id && <p className="text-red-500 text-xs mt-1">{errors.session_id}</p>}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <div className="flex flex-col items-end gap-2">
            {submitError && <p className="text-red-500 text-xs">{submitError}</p>}
            <button
              onClick={submit}
              disabled={submitting || sessions.length === 0}
              className="px-8 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50"
            >
              {submitting ? '送信中...' : '申し込む'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
