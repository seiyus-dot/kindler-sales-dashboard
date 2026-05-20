'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase, Client } from '@/lib/supabase'

type Props = {
  initial?: Client | null
  onClose: () => void
  onSaved: (client: Client) => void
}

export default function ClientForm({ initial, onClose, onSaved }: Props) {
  const [companyName, setCompanyName]         = useState(initial?.company_name ?? '')
  const [companyNameKana, setCompanyNameKana] = useState(initial?.company_name_kana ?? '')
  const [repName, setRepName]                 = useState(initial?.rep_name ?? '')
  const [repTitle, setRepTitle]               = useState(initial?.rep_title ?? '代表取締役')
  const [contactName, setContactName]         = useState(initial?.contact_name ?? '')
  const [contactTitle, setContactTitle]       = useState(initial?.contact_title ?? '')
  const [contactEmail, setContactEmail]       = useState(initial?.contact_email ?? '')
  const [contactPhone, setContactPhone]       = useState(initial?.contact_phone ?? '')
  const [postalCode, setPostalCode]           = useState(initial?.postal_code ?? '')
  const [address, setAddress]                 = useState(initial?.address ?? '')
  const [mfPartnerId, setMfPartnerId]         = useState(initial?.mf_partner_id ?? '')
  const [cloudsignSendEmail, setCloudsignSendEmail] = useState(initial?.cloudsign_send_email ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError('')
    if (!companyName.trim()) { setError('法人名を入力してください'); return }

    const payload = {
      company_name: companyName.trim(),
      company_name_kana: companyNameKana.trim() || null,
      rep_name: repName.trim() || null,
      rep_title: repTitle.trim() || null,
      contact_name: contactName.trim() || null,
      contact_title: contactTitle.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      postal_code: postalCode.trim() || null,
      address: address.trim() || null,
      mf_partner_id: mfPartnerId.trim() || null,
      cloudsign_send_email: cloudsignSendEmail.trim() || null,
      notes: notes.trim() || null,
    }

    setSaving(true)
    const query = initial
      ? supabase.from('clients').update(payload).eq('id', initial.id).select('*').single()
      : supabase.from('clients').insert(payload).select('*').single()

    const { data, error: err } = await query
    setSaving(false)

    if (err || !data) {
      setError(err?.message ?? '保存に失敗しました')
      return
    }
    onSaved(data as Client)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {initial ? 'クライアント情報を編集' : '新規クライアント登録'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              請求書・契約書・クラウドサイン送付に使う取引先情報を登録します
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 法人情報 */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">法人情報</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  法人名 <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="例：株式会社〇〇"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">正式な法人名称（前株・後株に注意）</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">法人名（カナ）</label>
                <input
                  className="input"
                  type="text"
                  placeholder="カブシキガイシャマルマル"
                  value={companyNameKana}
                  onChange={e => setCompanyNameKana(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">代表者氏名</label>
                <input
                  className="input"
                  type="text"
                  placeholder="山田 太郎"
                  value={repName}
                  onChange={e => setRepName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">代表者役職</label>
                <input
                  className="input"
                  type="text"
                  placeholder="代表取締役"
                  value={repTitle}
                  onChange={e => setRepTitle(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 担当者 */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">担当者</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">担当者氏名</label>
                <input
                  className="input"
                  type="text"
                  placeholder="鈴木 一郎"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">担当者役職</label>
                <input
                  className="input"
                  type="text"
                  placeholder="人事部長"
                  value={contactTitle}
                  onChange={e => setContactTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">メールアドレス</label>
                <input
                  className="input"
                  type="email"
                  placeholder="suzuki@example.co.jp"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">電話番号</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="03-1234-5678"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 住所 */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">住所</h3>
            <div className="grid sm:grid-cols-[160px_1fr] gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">郵便番号</label>
                <input
                  className="input"
                  type="text"
                  placeholder="100-0001"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">所在地</label>
                <input
                  className="input"
                  type="text"
                  placeholder="東京都千代田区〇〇1-2-3 ◯◯ビル4F"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 外部連携ID */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">外部サービス連携（任意）</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">マネーフォワード取引先ID</label>
                <input
                  className="input"
                  type="text"
                  placeholder="MFで登録済の場合のみ"
                  value={mfPartnerId}
                  onChange={e => setMfPartnerId(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">空欄なら発行時に自動作成（Phase 2）</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">クラウドサイン送付先メール</label>
                <input
                  className="input"
                  type="email"
                  placeholder="担当者と異なる場合のみ"
                  value={cloudsignSendEmail}
                  onChange={e => setCloudsignSendEmail(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* メモ */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">メモ</h3>
            <textarea
              className="input min-h-[72px]"
              placeholder="特記事項があれば（例：請求書は紙のみ郵送希望）"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {saving ? '保存中…' : (initial ? '更新する' : '登録する')}
          </button>
        </div>
      </div>
    </div>
  )
}
