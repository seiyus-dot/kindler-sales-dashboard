'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Link2, Unlink, Mail, Sheet, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

// 外部サービス連携（本人の分だけ）。AI（MCP）が本人の名前でGmail・スプレッドシートなどを使うための許可を管理する。
// claude.ai / ChatGPT のコネクタはつなぎ直さなくてよい。権限が足りないときはAIがこのページを案内する。
// サービスを増やすときは SERVICES に1件足し、対応する status / start / disconnect のAPIを用意する。

type ScopeState = { scope: string; granted: boolean }
type Status = {
  email: string
  google: { configured: boolean; connected: boolean; updated_at: string | null; scopes: ScopeState[] }
}

const SCOPE_LABELS: Record<string, { label: string; detail: string; icon: React.ElementType }> = {
  'https://www.googleapis.com/auth/gmail.readonly': {
    label: 'Gmailを読む',
    detail: 'お客さんとのやり取りを検索・要約する',
    icon: Mail,
  },
  'https://www.googleapis.com/auth/gmail.compose': {
    label: 'Gmailの下書き作成・送信',
    detail: '下書きを作り、本人が確認して「送信して」と言ったときだけ送る',
    icon: Mail,
  },
  'https://www.googleapis.com/auth/spreadsheets': {
    label: 'スプレッドシートの読み書き',
    detail: '「KINDLER 営業行動管理」の案件・商談・行動実績を記録する（このシートだけを対象にしています）',
    icon: Sheet,
  },
}

const MESSAGES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  'linked=google': { tone: 'ok', text: 'Googleの許可を更新しました。AIとの新しいチャットから使えます。' },
  'error=denied': { tone: 'error', text: 'Googleの同意画面でキャンセルされました。もう一度お試しください。' },
  'error=forbidden': { tone: 'error', text: 'このアカウントは連携を使えません。管理者に確認してください。' },
  'error=not_configured': { tone: 'error', text: 'Google連携のサーバー設定がまだありません。管理者に連絡してください。' },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function IntegrationsPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/status', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? '読み込めませんでした')
      setStatus(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const query = window.location.search.replace(/^\?/, '')
    if (MESSAGES[query]) {
      setNotice(MESSAGES[query])
      window.history.replaceState(null, '', '/integrations')
    }
    fetchAll()
  }, [])

  async function disconnectGoogle() {
    if (!confirm('Googleの連携を解除しますか？\nAIからGmail・スプレッドシートが使えなくなります（あとからいつでも許可し直せます）。')) return
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/google/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? '解除できませんでした')
      setNotice({ tone: 'ok', text: 'Googleの連携を解除しました。' })
      await fetchAll()
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const google = status?.google
  const missing = google?.scopes.filter((s) => !s.granted) ?? []
  const googleState: 'none' | 'partial' | 'ok' = !google?.connected ? 'none' : missing.length > 0 ? 'partial' : 'ok'

  return (
    <div className="max-w-3xl">
      <PageHeader title="外部サービス連携" sub="AI（Claude・ChatGPT）があなたの名前で使うサービスの許可を管理します" />

      <div className="flex gap-3 bg-white border border-[#e0e6f0] rounded-xl px-4 py-3 mb-5">
        <ShieldCheck size={18} className="text-gold shrink-0 mt-0.5" />
        <p className="text-xs text-[#334155] leading-relaxed">
          ここで許可した範囲だけ、AIがあなたの権限で操作します。claude.ai や ChatGPT の
          <span className="font-bold">コネクタはつなぎ直す必要はありません</span>
          。新しい機能で権限が必要になったときは、AIがこのページへのリンクを案内します。
        </p>
      </div>

      {notice && (
        <div
          className={`text-sm rounded-xl px-4 py-3 mb-4 border ${
            notice.tone === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">読み込めませんでした: {error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">読み込み中…</p>
      ) : google ? (
        <section className="bg-white border border-[#e0e6f0] rounded-2xl shadow-sm overflow-hidden">
          <header className="flex items-center gap-3 px-5 py-4 border-b border-[#eef1f7]">
            <div className="w-9 h-9 rounded-lg bg-[#eef2fa] text-navy flex items-center justify-center font-black">G</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-[#1a2540]">Google</h2>
              <p className="text-[11px] text-gray-400 truncate">{status?.email}</p>
            </div>
            {googleState === 'ok' && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">連携済み</span>
            )}
            {googleState === 'partial' && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                未許可の権限あり
              </span>
            )}
            {googleState === 'none' && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-200">未連携</span>
            )}
          </header>

          <ul className="px-5 py-2">
            {google.scopes.map((s) => {
              const meta = SCOPE_LABELS[s.scope] ?? { label: s.scope, detail: '', icon: Circle }
              const Icon = meta.icon
              return (
                <li key={s.scope} className="flex items-start gap-3 py-3 border-b border-[#f1f4f9] last:border-0">
                  <Icon size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1a2540]">{meta.label}</p>
                    {meta.detail && <p className="text-xs text-gray-400 mt-0.5">{meta.detail}</p>}
                  </div>
                  {s.granted ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-700 shrink-0">
                      <CheckCircle2 size={15} />許可済み
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 shrink-0">
                      <AlertTriangle size={15} />未許可
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          <footer className="flex flex-wrap items-center gap-2 px-5 py-4 bg-[#f7f9fd] border-t border-[#eef1f7]">
            {google.configured ? (
              <a
                href="/api/integrations/google/start"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy text-white text-sm font-bold hover:bg-[#16305c] transition-colors"
              >
                <Link2 size={15} />
                {googleState === 'none' ? 'Googleを許可する' : googleState === 'partial' ? '権限を追加する' : '許可し直す'}
              </a>
            ) : (
              <p className="text-xs text-red-600">サーバーの設定が未完了のため連携できません。管理者に連絡してください。</p>
            )}
            {google.connected && (
              <button
                onClick={disconnectGoogle}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e0e6f0] bg-white text-xs font-bold text-slate-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
              >
                <Unlink size={14} />
                連携を解除
              </button>
            )}
            {google.updated_at && (
              <span className="ml-auto text-[11px] text-gray-400">最終更新 {formatDate(google.updated_at)}</span>
            )}
          </footer>
          {googleState !== 'ok' && google.configured && (
            <p className="px-5 pb-4 bg-[#f7f9fd] text-[11px] text-gray-500">
              Googleの同意画面では、<span className="font-bold">すべての項目にチェック</span>を入れてください。ダッシュボードにログイン中と同じアカウント（{status?.email}）を選びます。
            </p>
          )}
        </section>
      ) : null}

      <div className="flex items-center justify-between mt-4">
        <p className="text-[11px] text-gray-400">ほかのサービス（Chatworkなど）は、対応したらここに追加されます。</p>
        <button onClick={fetchAll} className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-navy">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          状態を更新
        </button>
      </div>
    </div>
  )
}
