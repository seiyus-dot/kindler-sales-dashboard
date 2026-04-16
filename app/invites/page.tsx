'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { UserPlus, Trash2, Shield, User, Pencil } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

type AllowedEmail = {
  email: string
  role: 'admin' | 'member'
  allowed_pages: string[]
}

const ALL_PAGES = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/deals', label: '案件管理' },
  { href: '/weekly', label: '週次ログ' },
  { href: '/members', label: 'メンバー' },
  { href: '/settings', label: 'マスタ設定' },
  { href: '/knowledge', label: '営業ナレッジ' },
  { href: '/aicamp', label: 'AI CAMP' },
  { href: '/product-aicamp', label: 'Product AI CAMP' },
  { href: '/utage', label: 'UTAGE' },
  { href: '/advisor',         label: 'AI顧問管理' },
  { href: '/order-form',     label: '発注フォーム' },
  { href: '/order-requests', label: '発注リスト' },
]

export default function InvitesPage() {
  const [invites, setInvites] = useState<AllowedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AllowedEmail | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member')
  const [newPages, setNewPages] = useState<string[]>(['/aicamp'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchInvites = useCallback(async () => {
    const { data } = await supabase
      .from('allowed_emails')
      .select('email, role, allowed_pages')
    setInvites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  function openAdd() {
    setEditTarget(null)
    setNewEmail('')
    setNewRole('member')
    setNewPages(['/aicamp'])
    setError(null)
    setShowForm(true)
  }

  function openEdit(invite: AllowedEmail) {
    setEditTarget(invite)
    setNewEmail(invite.email)
    setNewRole(invite.role)
    setNewPages(invite.allowed_pages ?? ['/aicamp'])
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!newEmail) return
    setSaving(true)
    setError(null)
    const pages = newRole === 'admin' ? ALL_PAGES.map(p => p.href) : newPages
    const { error: err } = await supabase
      .from('allowed_emails')
      .upsert({ email: newEmail.toLowerCase().trim(), role: newRole, allowed_pages: pages }, { onConflict: 'email' })
    if (err) {
      setError('保存に失敗しました。RLSポリシーの設定が必要かもしれません。')
    } else {
      await fetchInvites()
      closeForm()
    }
    setSaving(false)
  }

  const handleDelete = async (email: string) => {
    if (!confirm(`${email} の招待を削除しますか？`)) return
    await supabase.from('allowed_emails').delete().eq('email', email)
    await fetchInvites()
  }

  const togglePage = (page: string) => {
    setNewPages(prev =>
      prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageHeader
          title="招待管理"
          sub="アクセスを許可するGoogleアカウントを管理します"
          right={
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-[#152f5a] transition-colors">
              <UserPlus size={16} />招待を追加
            </button>
          }
        />
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {editTarget ? '権限を編集' : '新しい招待'}
          </h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス（Googleアカウント）</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="input w-full"
                disabled={!!editTarget}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">ロール</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setNewRole('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${newRole === 'admin' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Shield size={14} />
                  Admin（全ページ）
                </button>
                <button
                  onClick={() => setNewRole('member')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${newRole === 'member' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <User size={14} />
                  Member（ページ選択）
                </button>
              </div>
            </div>
            {newRole === 'member' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">アクセス可能なページ</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PAGES.map(page => (
                    <label key={page.href} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={newPages.includes(page.href)}
                        onChange={() => togglePage(page.href)}
                        className="accent-indigo-600"
                      />
                      <span className="text-sm text-slate-700">{page.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !newEmail}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存する'}
              </button>
              <button
                onClick={closeForm}
                className="px-5 py-2 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">読み込み中...</div>
        ) : invites.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">招待済みアカウントがありません</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">メールアドレス</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">ロール</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">アクセス可能ページ</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite, i) => (
                <tr key={invite.email} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-5 py-4 text-sm text-slate-800">{invite.email}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${invite.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {invite.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                      {invite.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {invite.role === 'admin'
                      ? '全ページ'
                      : (invite.allowed_pages ?? []).map(p => ALL_PAGES.find(x => x.href === p)?.label ?? p).join('・')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(invite)}
                        className="text-slate-400 hover:text-indigo-500 transition-colors p-2"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(invite.email)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
