'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Contact, Company, DealToC, AICampConsultation, ProductAICampCustomer, DealToB } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2, ChevronRight } from 'lucide-react'

type Tab = 'contacts' | 'companies'

type ContactWithHistory = Contact & {
  deals_toc: Pick<DealToC, 'id' | 'service' | 'status' | 'actual_amount' | 'payment_date'>[]
  aicamp_consultations: Pick<AICampConsultation, 'id' | 'service_type' | 'status' | 'payment_amount' | 'payment_date'>[]
  product_aicamp_customers: (Pick<ProductAICampCustomer, 'id' | 'status'> & { session?: { title: string; session_date: string } | null })[]
}

type CompanyWithHistory = Company & {
  deals_tob: Pick<DealToB, 'id' | 'service' | 'status' | 'actual_amount' | 'contract_amount' | 'payment_date' | 'company_name' | 'contract_date' | 'contract_start' | 'contract_end'>[]
}

const emptyContact = () => ({ name: '', phone: '', email: '', notes: '' })
const emptyCompany = () => ({ name: '', industry: '', notes: '' })

const STATUS_BADGE: Record<string, string> = {
  '受注': 'bg-green-100 text-green-700',
  '成約': 'bg-green-100 text-green-700',
  '修了': 'bg-green-100 text-green-700',
  '申込済': 'bg-blue-100 text-blue-700',
  '失注': 'bg-red-100 text-red-600',
  'キャンセル': 'bg-red-100 text-red-600',
  '保留': 'bg-amber-100 text-amber-700',
}

function statusBadge(s?: string) {
  return STATUS_BADGE[s ?? ''] ?? 'bg-slate-100 text-slate-500'
}

export default function CustomersPage() {
  const [tab, setTab] = useState<Tab>('contacts')
  const [contacts, setContacts] = useState<ContactWithHistory[]>([])
  const [companies, setCompanies] = useState<CompanyWithHistory[]>([])
  const [search, setSearch] = useState('')

  // 詳細ドロワー
  const [selectedContact, setSelectedContact] = useState<ContactWithHistory | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithHistory | null>(null)

  // 登録・編集フォーム
  const [contactModal, setContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactDraft, setContactDraft] = useState(emptyContact())
  const [savingContact, setSavingContact] = useState(false)

  const [companyModal, setCompanyModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [companyDraft, setCompanyDraft] = useState(emptyCompany())
  const [savingCompany, setSavingCompany] = useState(false)

  const [error, setError] = useState<string | null>(null)

  // 受注済み案件から顧客マスタを自動生成・リンク
  async function syncFromDeals() {
    // ---- 法人: deals_tob の受注 → companies ----
    const { data: wonDeals } = await supabase
      .from('deals_tob')
      .select('id, company_name, industry')
      .eq('status', '受注')
      .is('company_id', null)

    if (wonDeals && wonDeals.length > 0) {
      // company_name でグループ化（重複排除）
      const uniqueNames = [...new Map(wonDeals.map(d => [d.company_name, d])).values()]
      for (const deal of uniqueNames) {
        if (!deal.company_name) continue
        // 既存チェック
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('name', deal.company_name)
          .maybeSingle()
        const companyId = existing?.id ?? (await supabase
          .from('companies')
          .insert({ name: deal.company_name, industry: deal.industry ?? null })
          .select('id')
          .single()
        ).data?.id
        if (!companyId) continue
        // 同名の全受注案件をリンク
        await supabase
          .from('deals_tob')
          .update({ company_id: companyId })
          .eq('company_name', deal.company_name)
          .eq('status', '受注')
          .is('company_id', null)
      }
    }

    // ---- 個人: aicamp_consultations の成約 → contacts ----
    const { data: contracted } = await supabase
      .from('aicamp_consultations')
      .select('id, name, line_name')
      .eq('status', '成約')
      .is('contact_id', null)

    if (contracted && contracted.length > 0) {
      const uniqueNames = [...new Map(contracted.map(d => [d.name ?? d.line_name, d])).values()]
      for (const c of uniqueNames) {
        const name = c.name ?? c.line_name
        if (!name) continue
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('name', name)
          .maybeSingle()
        const contactId = existing?.id ?? (await supabase
          .from('contacts')
          .insert({ name })
          .select('id')
          .single()
        ).data?.id
        if (!contactId) continue
        await supabase
          .from('aicamp_consultations')
          .update({ contact_id: contactId })
          .eq('status', '成約')
          .is('contact_id', null)
          .or(`name.eq.${name},line_name.eq.${name}`)
      }
    }
  }

  async function fetchAll() {
    const [cRes, coRes] = await Promise.all([
      supabase.from('contacts').select(`
        *,
        deals_toc(id, service, status, actual_amount, payment_date),
        aicamp_consultations(id, service_type, status, payment_amount, payment_date),
        product_aicamp_customers(id, status, session:product_aicamp_sessions(title, session_date))
      `).order('created_at', { ascending: false }),
      supabase.from('companies').select(`
        *,
        deals_tob(id, service, status, actual_amount, contract_amount, payment_date, company_name, contract_date, contract_start, contract_end)
      `).order('created_at', { ascending: false }),
    ])
    if (cRes.error) setError(cRes.error.message)
    else setContacts(cRes.data as ContactWithHistory[])
    if (coRes.error) setError(coRes.error.message)
    else setCompanies(coRes.data as CompanyWithHistory[])
  }

  useEffect(() => {
    syncFromDeals().then(() => fetchAll())
  }, [])

  // 検索フィルタ
  const filteredContacts = useMemo(() =>
    contacts.filter(c => !search || c.name.includes(search) || c.email?.includes(search) || c.phone?.includes(search)),
    [contacts, search])

  const filteredCompanies = useMemo(() =>
    companies.filter(c => !search || c.name.includes(search) || c.industry?.includes(search)),
    [companies, search])

  // 個人顧客の合計着金
  function contactTotal(c: ContactWithHistory) {
    const toc = c.deals_toc.reduce((s, d) => s + (d.actual_amount ?? 0), 0)
    const ai = c.aicamp_consultations.reduce((s, d) => s + Math.round((d.payment_amount ?? 0) / 10000), 0)
    return toc + ai
  }

  // 法人顧客の合計着金
  function companyTotal(c: CompanyWithHistory) {
    return c.deals_tob.reduce((s, d) => s + (d.actual_amount ?? 0), 0)
  }

  // 個人顧客の購入サービス一覧（バッジ用）
  function contactServices(c: ContactWithHistory): string[] {
    const set = new Set<string>()
    c.deals_toc.forEach(d => d.service && set.add(d.service))
    c.aicamp_consultations.forEach(d => d.service_type && set.add(d.service_type))
    if (c.product_aicamp_customers.length > 0) set.add('Product AI CAMP')
    return Array.from(set)
  }

  // ---------- 個人顧客 CRUD ----------
  function openNewContact() {
    setEditingContact(null)
    setContactDraft(emptyContact())
    setContactModal(true)
  }

  function openEditContact(c: Contact) {
    setEditingContact(c)
    setContactDraft({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' })
    setContactModal(true)
  }

  async function saveContact() {
    if (!contactDraft.name.trim()) { setError('氏名を入力してください'); return }
    setError(null)
    setSavingContact(true)
    const payload = { name: contactDraft.name.trim(), phone: contactDraft.phone || null, email: contactDraft.email || null, notes: contactDraft.notes || null }
    const { error: e } = editingContact
      ? await supabase.from('contacts').update(payload).eq('id', editingContact.id)
      : await supabase.from('contacts').insert(payload)
    setSavingContact(false)
    if (e) { setError(e.message); return }
    setContactModal(false)
    fetchAll()
  }

  async function deleteContact(id: string) {
    if (!confirm('この顧客を削除しますか？（リンクされた案件のcontact_idはnullになります）')) return
    await supabase.from('contacts').delete().eq('id', id)
    setSelectedContact(null)
    fetchAll()
  }

  // ---------- 法人顧客 CRUD ----------
  function openNewCompany() {
    setEditingCompany(null)
    setCompanyDraft(emptyCompany())
    setCompanyModal(true)
  }

  function openEditCompany(c: Company) {
    setEditingCompany(c)
    setCompanyDraft({ name: c.name, industry: c.industry ?? '', notes: c.notes ?? '' })
    setCompanyModal(true)
  }

  async function saveCompany() {
    if (!companyDraft.name.trim()) { setError('会社名を入力してください'); return }
    setError(null)
    setSavingCompany(true)
    const payload = { name: companyDraft.name.trim(), industry: companyDraft.industry || null, notes: companyDraft.notes || null }
    const { error: e } = editingCompany
      ? await supabase.from('companies').update(payload).eq('id', editingCompany.id)
      : await supabase.from('companies').insert(payload)
    setSavingCompany(false)
    if (e) { setError(e.message); return }
    setCompanyModal(false)
    fetchAll()
  }

  async function deleteCompany(id: string) {
    if (!confirm('この法人顧客を削除しますか？（リンクされた案件のcompany_idはnullになります）')) return
    await supabase.from('companies').delete().eq('id', id)
    setSelectedCompany(null)
    fetchAll()
  }

  return (
    <div className="flex h-full">
      {/* メインコンテンツ */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        <div className="max-w-4xl">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">顧客管理</h1>
              <p className="text-xs text-slate-400 mt-0.5">個人・法人顧客のマスタと購買履歴</p>
            </div>
            <button
              onClick={tab === 'contacts' ? openNewContact : openNewCompany}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              {tab === 'contacts' ? '個人顧客を追加' : '法人顧客を追加'}
            </button>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

          {/* タブ */}
          <div className="flex gap-1 mb-5 border-b border-slate-200">
            {([['contacts', `個人顧客 (${contacts.length})`], ['companies', `法人顧客 (${companies.length})`]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSearch(''); setSelectedContact(null); setSelectedCompany(null) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 検索 */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'contacts' ? '氏名・メール・電話で検索...' : '会社名・業種で検索...'}
            className="w-full mb-4 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 個人顧客一覧 */}
          {tab === 'contacts' && (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">個人顧客がまだ登録されていません</p>
              ) : filteredContacts.map(c => {
                const services = contactServices(c)
                const total = contactTotal(c)
                const dealCount = c.deals_toc.length + c.aicamp_consultations.length + c.product_aicamp_customers.length
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedContact?.id === c.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedContact(selectedContact?.id === c.id ? null : c)}
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{c.name}</span>
                        {services.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{s}</span>
                        ))}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {[c.phone, c.email].filter(Boolean).join('　') || '連絡先未登録'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono font-bold text-slate-800">{total > 0 ? `${total.toLocaleString()}万円` : '-'}</div>
                      <div className="text-xs text-slate-400">{dealCount}件の記録</div>
                    </div>
                    <ChevronRight size={16} className={`text-slate-300 flex-shrink-0 transition-transform ${selectedContact?.id === c.id ? 'rotate-90' : ''}`} />
                  </div>
                )
              })}
            </div>
          )}

          {/* 法人顧客一覧 */}
          {tab === 'companies' && (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {filteredCompanies.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">法人顧客がまだ登録されていません</p>
              ) : filteredCompanies.map(c => {
                const total = companyTotal(c)
                const services = [...new Set(c.deals_tob.map(d => d.service).filter(Boolean))] as string[]
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedCompany?.id === c.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedCompany(selectedCompany?.id === c.id ? null : c)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center text-navy font-bold text-sm flex-shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{c.name}</span>
                        {services.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{s}</span>
                        ))}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {c.industry ?? '業種未登録'}　{c.deals_tob.length}件の案件
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono font-bold text-slate-800">{total > 0 ? `${total.toLocaleString()}万円` : '-'}</div>
                      <div className="text-xs text-slate-400">着金合計</div>
                    </div>
                    <ChevronRight size={16} className={`text-slate-300 flex-shrink-0 transition-transform ${selectedCompany?.id === c.id ? 'rotate-90' : ''}`} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 詳細ドロワー（個人顧客） */}
      {selectedContact && (
        <aside className="w-96 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">{selectedContact.name}</h2>
              <div className="text-xs text-slate-400 mt-0.5 space-y-0.5">
                {selectedContact.phone && <div>{selectedContact.phone}</div>}
                {selectedContact.email && <div>{selectedContact.email}</div>}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <Link href={`/customers/contact/${selectedContact.id}`} className="px-2 py-1 text-[10px] text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50 transition">詳細</Link>
              <button onClick={() => openEditContact(selectedContact)} className="p-1.5 text-slate-400 hover:text-slate-700"><Pencil size={14} /></button>
              <button onClick={() => deleteContact(selectedContact.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
              <button onClick={() => setSelectedContact(null)} className="p-1.5 text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
            {selectedContact.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{selectedContact.notes}</p>
            )}

            {/* AI CAMP商談 */}
            {selectedContact.aicamp_consultations.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AI CAMP商談</h3>
                <div className="space-y-1.5">
                  {selectedContact.aicamp_consultations.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-slate-700">{d.service_type ?? 'AI CAMP'}</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(d.status)}`}>{d.status}</span>
                      </div>
                      <div className="text-right">
                        {d.payment_amount ? <span className="text-xs font-mono text-slate-700">{d.payment_amount.toLocaleString()}円</span> : null}
                        {d.payment_date && <div className="text-[10px] text-slate-400">{d.payment_date}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 個人案件 */}
            {selectedContact.deals_toc.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">個人案件</h3>
                <div className="space-y-1.5">
                  {selectedContact.deals_toc.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-slate-700">{d.service ?? '(サービス未設定)'}</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(d.status)}`}>{d.status}</span>
                      </div>
                      <div className="text-right">
                        {d.actual_amount ? <span className="text-xs font-mono text-slate-700">{d.actual_amount.toLocaleString()}万円</span> : null}
                        {d.payment_date && <div className="text-[10px] text-slate-400">{d.payment_date}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Product AI CAMP */}
            {selectedContact.product_aicamp_customers.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product AI CAMP</h3>
                <div className="space-y-1.5">
                  {selectedContact.product_aicamp_customers.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-slate-700">{d.session?.title ?? '(期未設定)'}</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(d.status)}`}>{d.status}</span>
                      </div>
                      {d.session?.session_date && <div className="text-[10px] text-slate-400">{d.session.session_date}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedContact.aicamp_consultations.length === 0 && selectedContact.deals_toc.length === 0 && selectedContact.product_aicamp_customers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">紐付けられた購買履歴がありません</p>
            )}
          </div>

          {/* 合計 */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">合計着金額</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {contactTotal(selectedContact) > 0 ? `${contactTotal(selectedContact).toLocaleString()}万円` : '-'}
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* 詳細ドロワー（法人顧客） */}
      {selectedCompany && (
        <aside className="w-96 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">{selectedCompany.name}</h2>
              {selectedCompany.industry && <p className="text-xs text-slate-400 mt-0.5">{selectedCompany.industry}</p>}
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <Link href={`/customers/company/${selectedCompany.id}`} className="px-2 py-1 text-[10px] text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50 transition">詳細</Link>
              <button onClick={() => openEditCompany(selectedCompany)} className="p-1.5 text-slate-400 hover:text-slate-700"><Pencil size={14} /></button>
              <button onClick={() => deleteCompany(selectedCompany.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
              <button onClick={() => setSelectedCompany(null)} className="p-1.5 text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
            {selectedCompany.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{selectedCompany.notes}</p>
            )}

            {selectedCompany.deals_tob.length > 0 ? (
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">法人案件</h3>
                <div className="space-y-1.5">
                  {selectedCompany.deals_tob.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-slate-700">{d.service ?? '(サービス未設定)'}</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge(d.status)}`}>{d.status}</span>
                      </div>
                      <div className="text-right">
                        {d.actual_amount
                          ? <span className="text-xs font-mono text-slate-700">{d.actual_amount.toLocaleString()}万円</span>
                          : d.contract_amount
                          ? <span className="text-xs font-mono text-slate-400">{d.contract_amount.toLocaleString()}万円(見込)</span>
                          : null}
                        {d.contract_date && <div className="text-[10px] text-slate-400">締結 {d.contract_date}</div>}
                        {(d.contract_start || d.contract_end) && (
                          <div className="text-[10px] text-slate-400">{d.contract_start ?? '?'} 〜 {d.contract_end ?? '?'}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">紐付けられた案件がありません</p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">着金合計</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {companyTotal(selectedCompany) > 0 ? `${companyTotal(selectedCompany).toLocaleString()}万円` : '-'}
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ===== 個人顧客フォームモーダル ===== */}
      {contactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">{editingContact ? '個人顧客を編集' : '個人顧客を追加'}</h2>
              <button onClick={() => setContactModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">氏名 *</label>
                <input className="input" placeholder="例：山田 太郎" value={contactDraft.name} onChange={e => setContactDraft(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">電話番号</label>
                <input className="input" placeholder="090-0000-0000" value={contactDraft.phone} onChange={e => setContactDraft(d => ({ ...d, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メールアドレス</label>
                <input type="email" className="input" placeholder="example@email.com" value={contactDraft.email} onChange={e => setContactDraft(d => ({ ...d, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メモ</label>
                <textarea className="input" rows={2} value={contactDraft.notes} onChange={e => setContactDraft(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setContactModal(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">キャンセル</button>
              <button onClick={saveContact} disabled={savingContact} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingContact ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 法人顧客フォームモーダル ===== */}
      {companyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">{editingCompany ? '法人顧客を編集' : '法人顧客を追加'}</h2>
              <button onClick={() => setCompanyModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">会社名 *</label>
                <input className="input" placeholder="例：株式会社〇〇" value={companyDraft.name} onChange={e => setCompanyDraft(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">業種</label>
                <input className="input" placeholder="例：IT・Web" value={companyDraft.industry} onChange={e => setCompanyDraft(d => ({ ...d, industry: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メモ</label>
                <textarea className="input" rows={2} value={companyDraft.notes} onChange={e => setCompanyDraft(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setCompanyModal(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">キャンセル</button>
              <button onClick={saveCompany} disabled={savingCompany} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingCompany ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
