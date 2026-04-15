'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { CheckCircle2 } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SERVICES = [
  { id: 'ai_kenshu', label: 'AI研修（法人）' },
  { id: 'ai_camp',   label: 'AI CAMP（個人）' },
  { id: 'ai_step',   label: 'AIステップ' },
  { id: 'other',     label: 'その他' },
]

const STEPS = [
  { label: '企業情報' },
  { label: '担当者情報' },
  { label: '請求書送付先' },
  { label: '発注内容' },
]

type FormState = {
  company_name: string
  rep_name_kanji: string
  rep_name_kana: string
  company_phone: string
  contact_name_kanji: string
  contact_name_kana: string
  department: string
  position: string
  contact_email: string
  contact_phone: string
  billing_zip: string
  billing_address: string
  billing_name_kanji: string
  billing_name_kana: string
  billing_position: string
  billing_department: string
  billing_email: string
  services: string[]
  order_detail: string
}

const initialForm: FormState = {
  company_name: '', rep_name_kanji: '', rep_name_kana: '', company_phone: '',
  contact_name_kanji: '', contact_name_kana: '', department: '', position: '',
  contact_email: '', contact_phone: '',
  billing_zip: '', billing_address: '', billing_name_kanji: '', billing_name_kana: '',
  billing_position: '', billing_department: '', billing_email: '',
  services: [], order_detail: '',
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

export default function OrderFormPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const fetchAddress = async (zip: string) => {
    const digits = zip.replace(/[^0-9]/g, '')
    if (digits.length !== 7) return
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`)
      const json = await res.json()
      if (json.results?.[0]) {
        const { address1, address2, address3 } = json.results[0]
        setForm(f => ({ ...f, billing_address: address1 + address2 + address3 }))
      }
    } catch {}
  }

  const toggleService = (id: string) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(id)
        ? f.services.filter(s => s !== id)
        : [...f.services, id],
    }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (step === 0) {
      if (!form.company_name)   e.company_name   = '企業名を入力してください'
      if (!form.rep_name_kanji) e.rep_name_kanji = '代表者名（漢字）を入力してください'
      if (!form.rep_name_kana)  e.rep_name_kana  = '代表者名（フリガナ）を入力してください'
      if (!form.company_phone)  e.company_phone  = '代表電話番号を入力してください'
    }
    if (step === 1) {
      if (!form.contact_name_kanji) e.contact_name_kanji = '担当者名を入力してください'
      if (!form.contact_name_kana)  e.contact_name_kana  = '担当者名（フリガナ）を入力してください'
      if (!form.contact_email)      e.contact_email      = 'メールアドレスを入力してください'
    }
    if (step === 2) {
      if (!form.billing_zip)          e.billing_zip          = '郵便番号を入力してください'
      if (!form.billing_address)      e.billing_address      = '住所を入力してください'
      if (!form.billing_name_kanji)   e.billing_name_kanji   = '請求書担当者名を入力してください'
      if (!form.billing_name_kana)    e.billing_name_kana    = '請求書担当者名（フリガナ）を入力してください'
    }
    if (step === 3) {
      if (form.services.length === 0) e.services = '発注内容を選択してください'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validate()) setStep(s => s + 1) }
  const back = () => setStep(s => s - 1)

  const submit = async () => {
    if (!validate()) return
    setSubmitting(true)
    const payload = {
      company_name:       form.company_name,
      rep_name_kanji:     form.rep_name_kanji,
      rep_name_kana:      form.rep_name_kana,
      company_phone:      form.company_phone,
      contact_name_kanji: form.contact_name_kanji,
      contact_name_kana:  form.contact_name_kana,
      department:         form.department || null,
      position:           form.position || null,
      contact_email:      form.contact_email,
      contact_phone:      form.contact_phone || null,
      billing_zip:        form.billing_zip,
      billing_address:    form.billing_address,
      billing_name_kanji: form.billing_name_kanji,
      billing_name_kana:  form.billing_name_kana,
      billing_position:   form.billing_position || null,
      billing_department: form.billing_department || null,
      billing_email:      form.billing_email || null,
      services:           form.services,
      order_detail:       form.order_detail || null,
    }
    const res = await fetch('/api/order-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSubmitting(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: '送信に失敗しました' }))
      setSubmitError(error ?? '送信に失敗しました')
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-12 max-w-md w-full">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-6" />
          <h2 className="text-xl font-bold text-slate-800 mb-3">送信が完了しました</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            ご入力いただいた内容を確認の上、<br />
            担当者よりご連絡差し上げます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">見積書・発注書 作成フォーム</h1>
        <p className="text-sm text-slate-500 mt-1">4ステップで発注情報を入力してください</p>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              i === step
                ? 'bg-navy text-white'
                : i < step
                ? 'bg-navy/20 text-navy'
                : 'bg-slate-100 text-slate-400'
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i < step ? 'bg-navy text-white' : ''
              }`}>
                {i < step ? '✓' : i + 1}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px ${i < step ? 'bg-navy/40' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* フォームカード */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h2 className="text-base font-bold text-slate-700 mb-6 pb-3 border-b border-slate-100">
          STEP {step + 1} — {STEPS[step].label}
        </h2>

        {/* STEP 0: 企業情報 */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <FieldLabel label="企業名" required />
              <input className="input" value={form.company_name} onChange={set('company_name')} placeholder="例：KINDLER株式会社" />
              {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
            </div>
            <div>
              <FieldLabel label="代表者名（漢字）" required />
              <input className="input" value={form.rep_name_kanji} onChange={set('rep_name_kanji')} placeholder="例：山田 太郎" />
              {errors.rep_name_kanji && <p className="text-red-500 text-xs mt-1">{errors.rep_name_kanji}</p>}
            </div>
            <div>
              <FieldLabel label="代表者名（フリガナ）" required />
              <input className="input" value={form.rep_name_kana} onChange={set('rep_name_kana')} placeholder="例：ヤマダ タロウ" />
              {errors.rep_name_kana && <p className="text-red-500 text-xs mt-1">{errors.rep_name_kana}</p>}
            </div>
            <div>
              <FieldLabel label="代表電話番号" required />
              <input className="input" type="tel" value={form.company_phone} onChange={set('company_phone')} placeholder="例：03-0000-0000" />
              {errors.company_phone && <p className="text-red-500 text-xs mt-1">{errors.company_phone}</p>}
            </div>
          </div>
        )}

        {/* STEP 1: 担当者情報 */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <FieldLabel label="担当者名（漢字）" required />
              <input className="input" value={form.contact_name_kanji} onChange={set('contact_name_kanji')} placeholder="例：鈴木 花子" />
              {errors.contact_name_kanji && <p className="text-red-500 text-xs mt-1">{errors.contact_name_kanji}</p>}
            </div>
            <div>
              <FieldLabel label="担当者名（フリガナ）" required />
              <input className="input" value={form.contact_name_kana} onChange={set('contact_name_kana')} placeholder="例：スズキ ハナコ" />
              {errors.contact_name_kana && <p className="text-red-500 text-xs mt-1">{errors.contact_name_kana}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label="部署名" />
                <input className="input" value={form.department} onChange={set('department')} placeholder="例：経営企画部" />
              </div>
              <div>
                <FieldLabel label="役職名" />
                <input className="input" value={form.position} onChange={set('position')} placeholder="例：部長" />
              </div>
            </div>
            <div>
              <FieldLabel label="メールアドレス" required />
              <input className="input" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="例：hanako@example.com" />
              {errors.contact_email && <p className="text-red-500 text-xs mt-1">{errors.contact_email}</p>}
            </div>
            <div>
              <FieldLabel label="電話番号" />
              <input className="input" type="tel" value={form.contact_phone} onChange={set('contact_phone')} placeholder="例：090-0000-0000" />
            </div>
          </div>
        )}

        {/* STEP 2: 請求書送付先 */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <FieldLabel label="郵便番号" required />
              <div className="relative">
                <input
                  className="input"
                  value={form.billing_zip}
                  onChange={e => { set('billing_zip')(e); fetchAddress(e.target.value) }}
                  placeholder="例：100-0001（入力で住所を自動補完）"
                />
              </div>
              {errors.billing_zip && <p className="text-red-500 text-xs mt-1">{errors.billing_zip}</p>}
            </div>
            <div>
              <FieldLabel label="住所" required />
              <input className="input" value={form.billing_address} onChange={set('billing_address')} placeholder="例：東京都千代田区〇〇1-1-1" />
              {errors.billing_address && <p className="text-red-500 text-xs mt-1">{errors.billing_address}</p>}
            </div>
            <div>
              <FieldLabel label="請求書担当者名（漢字）" required />
              <input className="input" value={form.billing_name_kanji} onChange={set('billing_name_kanji')} placeholder="例：田中 一郎" />
              {errors.billing_name_kanji && <p className="text-red-500 text-xs mt-1">{errors.billing_name_kanji}</p>}
            </div>
            <div>
              <FieldLabel label="請求書担当者名（フリガナ）" required />
              <input className="input" value={form.billing_name_kana} onChange={set('billing_name_kana')} placeholder="例：タナカ イチロウ" />
              {errors.billing_name_kana && <p className="text-red-500 text-xs mt-1">{errors.billing_name_kana}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label="役職名" />
                <input className="input" value={form.billing_position} onChange={set('billing_position')} placeholder="例：経理部長" />
              </div>
              <div>
                <FieldLabel label="部署名" />
                <input className="input" value={form.billing_department} onChange={set('billing_department')} placeholder="例：経理部" />
              </div>
            </div>
            <div>
              <FieldLabel label="メールアドレス" />
              <p className="text-xs text-slate-400 mb-1.5">担当者と異なる場合のみご記入ください</p>
              <input className="input" type="email" value={form.billing_email} onChange={set('billing_email')} placeholder="例：keiri@example.com" />
            </div>
          </div>
        )}

        {/* STEP 3: 発注内容 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <FieldLabel label="ご発注内容" required />
              <div className="space-y-2 mt-2">
                {SERVICES.map(s => (
                  <label key={s.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    form.services.includes(s.id)
                      ? 'border-navy/40 bg-navy/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                      form.services.includes(s.id) ? 'bg-navy border-navy' : 'border-slate-300'
                    }`}>
                      {form.services.includes(s.id) && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={form.services.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="sr-only"
                    />
                    <span className="text-sm text-slate-700">{s.label}</span>
                  </label>
                ))}
              </div>
              {errors.services && <p className="text-red-500 text-xs mt-2">{errors.services}</p>}
            </div>
            <div>
              <FieldLabel label="発注内容（詳細）" />
              <p className="text-xs text-slate-400 mb-1.5">ご要望・背景・人数・実施希望時期などをご記入ください</p>
              <textarea
                className="input resize-y"
                rows={5}
                value={form.order_detail}
                onChange={set('order_detail')}
                placeholder="例：社員30名を対象に、ChatGPT活用の基礎研修を実施したい。2025年6月頃を想定。"
              />
            </div>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div className="flex items-center justify-between mt-6">
        {step > 0 ? (
          <button
            onClick={back}
            className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
          >
            戻る
          </button>
        ) : <div />}

        <div className="flex flex-col items-end gap-2">
          {submitError && (
            <p className="text-red-500 text-xs">{submitError}</p>
          )}

        {step < 3 ? (
          <button
            onClick={next}
            className="px-6 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 transition-colors"
          >
            次へ
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="px-8 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {submitting ? '送信中...' : '送信する'}
          </button>
        )}
        </div>
      </div>
    </div>
  )
}
