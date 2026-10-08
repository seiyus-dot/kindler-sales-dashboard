'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  MessageSquareQuote, Database, Mail, Receipt, CheckCircle2, XCircle, ChevronDown, ChevronRight, RefreshCw, Bot,
} from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { supabase, McpAuditLog } from '@/lib/supabase'

// MCPツールの実行ログ（管理者専用。middleware.ts の adminOnlyPages と mcp_audit_log のRLSで二重に守る）
// 同じ人・同じ依頼内容の連続した呼び出しを「1つの依頼」にまとめ、依頼 → AIが実行したこと の順に見せる。

const PERIODS = [
  { days: 1, label: '24時間' },
  { days: 7, label: '7日' },
  { days: 30, label: '30日' },
]

const GROUP_GAP_MS = 10 * 60 * 1000 // 同じ依頼でも10分以上空いたら別の依頼として扱う

type Category = { label: string; icon: React.ElementType; badge: string }

function categoryOf(tool: string): Category {
  if (tool.startsWith('gmail_')) return { label: 'Gmail', icon: Mail, badge: 'bg-rose-50 text-rose-700 border-rose-200' }
  if (tool.startsWith('mf_')) return { label: 'MF請求', icon: Receipt, badge: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'CRM', icon: Database, badge: 'bg-[#eef2fa] text-navy border-[#d5deef]' }
}

// 送信・作成・更新・削除など、データや外部に影響する操作を目立たせる
const WRITE_PATTERN = /(insert|update|delete|create|send|add|remove|convert)/
const isWrite = (tool: string) => WRITE_PATTERN.test(tool)

function clientLabel(ua: string | null): string {
  if (!ua) return '不明'
  const v = ua.toLowerCase()
  if (v.includes('claude') || v.includes('anthropic')) return 'Claude'
  if (v.includes('openai') || v.includes('chatgpt')) return 'ChatGPT'
  return ua.split(/[\s/]/)[0] || '不明'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

type Group = { key: string; actor: string; client: string | null; request: string | null; logs: McpAuditLog[] }

/** 新しい順のログを、同じ人・同じ依頼・時間が近いものごとにまとめる（各グループ内は古い順） */
function groupLogs(logs: McpAuditLog[]): Group[] {
  const groups: Group[] = []
  for (const log of logs) {
    const last = groups[groups.length - 1]
    const lastTime = last ? new Date(last.logs[last.logs.length - 1].created_at).getTime() : 0
    if (
      last &&
      last.actor === log.actor &&
      (last.request ?? '') === (log.user_request ?? '') &&
      lastTime - new Date(log.created_at).getTime() < GROUP_GAP_MS
    ) {
      last.logs.push(log)
    } else {
      groups.push({ key: log.id, actor: log.actor, client: log.client, request: log.user_request, logs: [log] })
    }
  }
  return groups.map((g) => ({ ...g, logs: [...g.logs].reverse() }))
}

export default function McpLogsPage() {
  const [logs, setLogs] = useState<McpAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [actor, setActor] = useState('')
  const [category, setCategory] = useState('')
  const [onlyWrites, setOnlyWrites] = useState(false)
  const [onlyErrors, setOnlyErrors] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('mcp_audit_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) setError(error.message)
    setLogs((data as McpAuditLog[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const actors = useMemo(() => [...new Set(logs.map((l) => l.actor))].sort(), [logs])

  const groups = useMemo(() => {
    const filtered = logs.filter(
      (l) =>
        (!actor || l.actor === actor) &&
        (!category || categoryOf(l.tool_name).label === category) &&
        (!onlyWrites || isWrite(l.tool_name)) &&
        (!onlyErrors || !l.success)
    )
    return groupLogs(filtered)
  }, [logs, actor, category, onlyWrites, onlyErrors])

  const stats = useMemo(
    () => ({
      calls: logs.length,
      writes: logs.filter((l) => isWrite(l.tool_name)).length,
      sends: logs.filter((l) => l.tool_name === 'gmail_send_draft' && l.success).length,
      errors: logs.filter((l) => !l.success).length,
    }),
    [logs]
  )

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title="MCP実行ログ"
        sub="AI（Claude・ChatGPT等）がMCP経由で何を依頼され、何を実行したか"
        right={
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e0e6f0] bg-white text-xs font-bold text-navy hover:bg-[#f0f4ff] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            更新
          </button>
        }
      />

      {/* サマリー */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'ツール実行', value: stats.calls, tone: 'text-[#1a2540]' },
          { label: '書き込み・送信', value: stats.writes, tone: 'text-navy' },
          { label: 'メール送信', value: stats.sends, tone: 'text-rose-600' },
          { label: 'エラー', value: stats.errors, tone: stats.errors ? 'text-red-600' : 'text-[#1a2540]' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#e0e6f0] rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-0.5 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 絞り込み */}
      <div className="bg-white border border-[#e0e6f0] rounded-xl p-3 mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[#e0e6f0] overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${days === p.days ? 'bg-navy text-white' : 'text-gray-500 hover:bg-[#f4f6fb]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select value={actor} onChange={(e) => setActor(e.target.value)} className="input !w-auto !py-1.5 text-xs">
          <option value="">全員</option>
          {actors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input !w-auto !py-1.5 text-xs">
          <option value="">全ツール</option>
          <option value="CRM">CRM</option>
          <option value="Gmail">Gmail</option>
          <option value="MF請求">MF請求</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 px-2 cursor-pointer">
          <input type="checkbox" checked={onlyWrites} onChange={(e) => setOnlyWrites(e.target.checked)} />
          書き込み・送信のみ
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 px-2 cursor-pointer">
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
          エラーのみ
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          読み込めませんでした: {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">読み込み中…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">この条件の実行ログはありません</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const hasWrite = g.logs.some((l) => isWrite(l.tool_name))
            const hasError = g.logs.some((l) => !l.success)
            return (
              <section
                key={g.key}
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${hasError ? 'border-red-200' : hasWrite ? 'border-[#d5deef]' : 'border-[#e0e6f0]'}`}
              >
                {/* 依頼 */}
                <header className="px-5 py-4 border-b border-[#eef1f7] bg-gradient-to-r from-[#f7f9fd] to-white">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 mb-2">
                    <span className="font-bold text-[#1a2540]">{g.actor}</span>
                    <span className="flex items-center gap-1"><Bot size={12} />{clientLabel(g.client)}</span>
                    <span className="tabular-nums">{formatTime(g.logs[0].created_at)}</span>
                    <span>{g.logs.length}件の実行</span>
                  </div>
                  <div className="flex gap-2.5">
                    <MessageSquareQuote size={18} className="text-gold shrink-0 mt-0.5" />
                    {g.request ? (
                      <p className="text-sm text-[#1a2540] leading-relaxed whitespace-pre-wrap">{g.request}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">依頼内容の記録なし（AIが申告しなかった呼び出し）</p>
                    )}
                  </div>
                </header>

                {/* AIが実行したこと */}
                <ol className="px-5 py-3">
                  {g.logs.map((l, i) => {
                    const cat = categoryOf(l.tool_name)
                    const Icon = cat.icon
                    const expanded = open.has(l.id)
                    return (
                      <li key={l.id} className="relative pl-6">
                        {i < g.logs.length - 1 && <span className="absolute left-[7px] top-6 bottom-0 w-px bg-[#e0e6f0]" />}
                        <span className={`absolute left-0 top-2.5 w-[15px] h-[15px] rounded-full border-2 bg-white ${l.success ? (isWrite(l.tool_name) ? 'border-navy' : 'border-[#c9d3e6]') : 'border-red-500'}`} />
                        <button onClick={() => toggle(l.id)} className="w-full text-left flex flex-wrap items-center gap-2 py-2 group">
                          {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cat.badge}`}>
                            <Icon size={11} />{cat.label}
                          </span>
                          <code className={`text-xs ${isWrite(l.tool_name) ? 'font-bold text-navy' : 'text-gray-600'}`}>{l.tool_name}</code>
                          {l.success ? (
                            <CheckCircle2 size={14} className="text-green-600" />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600"><XCircle size={14} />失敗</span>
                          )}
                          <span className="ml-auto text-[11px] text-gray-400 tabular-nums">
                            {formatTime(l.created_at)}{l.duration_ms != null && ` ・ ${l.duration_ms}ms`}
                          </span>
                        </button>
                        {expanded && (
                          <div className="ml-5 mb-3 space-y-2">
                            <Detail label="引数" value={JSON.stringify(l.args, null, 2)} />
                            {l.error_message && <Detail label="エラー" value={l.error_message} tone="error" />}
                            {l.result_summary && <Detail label="結果（先頭部分）" value={prettyJson(l.result_summary)} />}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
          {logs.length >= 500 && (
            <p className="text-xs text-gray-400 text-center">新しい500件まで表示しています。期間を短くすると絞り込めます。</p>
          )}
        </div>
      )}
    </div>
  )
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: 'error' }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-wider text-gray-400 mb-1">{label}</p>
      <pre
        className={`text-[11px] leading-relaxed rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all max-h-64 ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-[#f4f6fb] text-[#334155]'}`}
      >
        {value}
      </pre>
    </div>
  )
}
