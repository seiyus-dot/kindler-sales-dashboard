/**
 * 営業メンバー本人のGmailを使うMCPツール。
 *
 * MCP接続時に「Googleアカウントで接続」したメンバーだけが使える（actor＝本人のメールアドレス）。
 * 共有の接続キーで接続したクライアントからは、誰のGmailか決まらないので使えない。
 *
 * 送信は「下書き作成 → 本人が内容を確認 → 下書きを送信」の2段階に限る。
 * 宛先と本文を渡して即送信するツールは意図的に用意していない（誤送信は取り消せないため）。
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { gmail_v1 } from 'googleapis'
import { gmailClientFor } from './gmail-auth'
import { isUserActor } from './mcp-oauth'
import { mcpSupabaseAdmin } from './mcp-supabase-admin'
import { actorFrom } from './mf-write-audit'
import { memberIdFor } from './mcp-member'

type Extra = { authInfo?: { clientId?: string } } | undefined

const BODY_MAX_CHARS = 8000

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `エラー: ${message}` }], isError: true }
}

function messageOf(e: unknown): string {
  if (e instanceof Error) {
    // リフレッシュトークンが失効・取り消しされた場合（パスワード変更・連携解除など）
    if (e.message.includes('invalid_grant')) {
      return 'Gmailの連携が切れています。MCPコネクタを一度切断し、「Googleアカウントで接続」でつなぎ直してください。'
    }
    return e.message
  }
  return String(e)
}

function requireUser(extra: Extra): string {
  const actor = actorFrom(extra)
  if (!isUserActor(actor)) {
    throw new Error(
      'Gmailツールは「Googleアカウントで接続」したときだけ使えます。今の接続は共有の接続キーのため、誰のGmailか特定できません。'
    )
  }
  return actor
}

// ---------------------------------------------
// メッセージの読み取り
// ---------------------------------------------
function header(msg: gmail_v1.Schema$Message, name: string): string {
  const h = msg.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8')
}

function findPart(part: gmail_v1.Schema$MessagePart | undefined, mime: string): gmail_v1.Schema$MessagePart | null {
  if (!part) return null
  if (part.mimeType === mime && part.body?.data) return part
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime)
    if (found) return found
  }
  return null
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function bodyText(msg: gmail_v1.Schema$Message): string {
  const plain = findPart(msg.payload, 'text/plain')
  if (plain?.body?.data) return decodeBase64Url(plain.body.data)
  const html = findPart(msg.payload, 'text/html')
  if (html?.body?.data) return htmlToText(decodeBase64Url(html.body.data))
  return msg.snippet ?? ''
}

function truncate(text: string): string {
  return text.length > BODY_MAX_CHARS ? `${text.slice(0, BODY_MAX_CHARS)}\n…（以下省略）` : text
}

// ---------------------------------------------
// メッセージの組み立て（RFC 2822 / UTF-8）
// 宛先はメールアドレスのみ受け付け、件名の改行は除去する（ヘッダインジェクション防止）
// ---------------------------------------------
function encodeHeaderValue(v: string): string {
  const oneLine = v.replace(/[\r\n]+/g, ' ').trim()
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(oneLine) ? oneLine : `=?UTF-8?B?${Buffer.from(oneLine, 'utf8').toString('base64')}?=`
}

function buildRaw(args: {
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}): string {
  const lines = [
    `From: ${args.from}`,
    `To: ${args.to.join(', ')}`,
    ...(args.cc?.length ? [`Cc: ${args.cc.join(', ')}`] : []),
    ...(args.bcc?.length ? [`Bcc: ${args.bcc.join(', ')}`] : []),
    `Subject: ${encodeHeaderValue(args.subject)}`,
    ...(args.inReplyTo ? [`In-Reply-To: ${args.inReplyTo}`] : []),
    ...(args.references ? [`References: ${args.references}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    (Buffer.from(args.body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').match(/.{1,76}/g) ?? []).join('\r\n'),
  ]
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url')
}

/** 返信用に、スレッド最後のメッセージから件名・In-Reply-To・Referencesを決める */
async function replyContext(gmail: gmail_v1.Gmail, threadId: string) {
  const { data } = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'Message-ID', 'References'],
  })
  const last = data.messages?.[data.messages.length - 1]
  if (!last) throw new Error('返信先のスレッドが見つかりません')
  const messageId = header(last, 'Message-ID')
  const refs = header(last, 'References')
  const subject = header(last, 'Subject')
  return {
    subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    inReplyTo: messageId || undefined,
    references: [refs, messageId].filter(Boolean).join(' ') || undefined,
  }
}

const draftFields = {
  to: z.array(z.string().email()).min(1).describe('宛先メールアドレスの配列'),
  cc: z.array(z.string().email()).optional().describe('CCメールアドレスの配列'),
  bcc: z.array(z.string().email()).optional().describe('BCCメールアドレスの配列'),
  subject: z.string().optional().describe('件名。reply_to_thread_id指定時に省略すると「Re: 元の件名」になる'),
  body: z.string().min(1).describe('本文（プレーンテキスト）。署名も本文に含めて書く'),
  reply_to_thread_id: z
    .string()
    .optional()
    .describe('既存スレッドへの返信として下書きする場合のthread_id（gmail_search_threadsで取得）'),
}

type DraftInput = {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  body: string
  reply_to_thread_id?: string
}

async function draftMessage(
  gmail: gmail_v1.Gmail,
  from: string,
  input: DraftInput
): Promise<{ message: gmail_v1.Schema$Message; subject: string }> {
  const reply = input.reply_to_thread_id ? await replyContext(gmail, input.reply_to_thread_id) : null
  const subject = input.subject ?? reply?.subject
  if (!subject) throw new Error('subject（件名）を指定してください')
  const message: gmail_v1.Schema$Message = {
    raw: buildRaw({
      from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject,
      body: input.body,
      inReplyTo: reply?.inReplyTo,
      references: reply?.references,
    }),
    ...(input.reply_to_thread_id ? { threadId: input.reply_to_thread_id } : {}),
  }
  return { message, subject }
}

function draftPreview(input: DraftInput, subject: string) {
  return { to: input.to, cc: input.cc ?? [], bcc: input.bcc ?? [], subject, body: input.body }
}

function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function registerGmailTools(server: McpServer) {
  server.tool(
    'gmail_search_threads',
    '接続している営業メンバー本人のGmailからスレッドを検索する。queryにはGmailの検索演算子が使える' +
      '（例: "from:tanaka@example.co.jp", "to:info@example.com newer_than:30d", "subject:見積"）。' +
      '顧客とのやり取りを確認するときは、まずquery_rowsでcontacts/companies/deals_tobから相手のメールアドレスを調べてから検索すると確実。',
    {
      query: z.string().describe('Gmailの検索クエリ'),
      max_results: z.number().int().min(1).max(25).optional().describe('最大件数。既定10'),
    },
    async ({ query, max_results }, extra) => {
      try {
        const gmail = await gmailClientFor(requireUser(extra))
        const { data } = await gmail.users.threads.list({ userId: 'me', q: query, maxResults: max_results ?? 10 })
        const threads = await Promise.all(
          (data.threads ?? []).map(async (t) => {
            const { data: th } = await gmail.users.threads.get({
              userId: 'me',
              id: t.id!,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date'],
            })
            const first = th.messages?.[0]
            const last = th.messages?.[th.messages.length - 1]
            return {
              thread_id: t.id,
              subject: first ? header(first, 'Subject') : '',
              from: first ? header(first, 'From') : '',
              to: first ? header(first, 'To') : '',
              last_date: last ? header(last, 'Date') : '',
              message_count: th.messages?.length ?? 0,
              snippet: last?.snippet ?? t.snippet ?? '',
            }
          })
        )
        return textResult({ query, count: threads.length, threads })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'gmail_get_thread',
    'Gmailのスレッドの全メッセージ（差出人・宛先・日時・本文）を取得する。thread_idはgmail_search_threadsで取得する。',
    { thread_id: z.string() },
    async ({ thread_id }, extra) => {
      try {
        const gmail = await gmailClientFor(requireUser(extra))
        const { data } = await gmail.users.threads.get({ userId: 'me', id: thread_id, format: 'full' })
        return textResult({
          thread_id,
          messages: (data.messages ?? []).map((m) => ({
            message_id: m.id,
            from: header(m, 'From'),
            to: header(m, 'To'),
            cc: header(m, 'Cc'),
            date: header(m, 'Date'),
            subject: header(m, 'Subject'),
            body: truncate(bodyText(m)),
          })),
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'gmail_create_draft',
    '接続している営業メンバー本人のGmailに、メールの下書きを作成する（この時点では送信されない）。' +
      '作成後は必ず宛先・件名・本文をそのまま利用者に提示し、修正があればgmail_update_draftで直す。' +
      '既存のやり取りへの返信はreply_to_thread_idを指定すると同じスレッドに入る。',
    draftFields,
    async (input, extra) => {
      try {
        const email = requireUser(extra)
        const gmail = await gmailClientFor(email)
        const { message, subject } = await draftMessage(gmail, email, input)
        const { data } = await gmail.users.drafts.create({ userId: 'me', requestBody: { message } })
        return textResult({
          draft_id: data.id,
          status: '下書きを作成しました（未送信）',
          preview: draftPreview(input, subject),
          gmail_url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#drafts`,
          next_step: '内容を利用者に確認してもらい、「送信して」と明示的に指示されたらgmail_send_draftを呼ぶ',
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'gmail_update_draft',
    '作成済みの下書きを修正する（全項目を指定し直して上書きする）。送信はされない。',
    { draft_id: z.string(), ...draftFields },
    async ({ draft_id, ...input }, extra) => {
      try {
        const email = requireUser(extra)
        const gmail = await gmailClientFor(email)
        const { message, subject } = await draftMessage(gmail, email, input)
        const { data } = await gmail.users.drafts.update({ userId: 'me', id: draft_id, requestBody: { id: draft_id, message } })
        return textResult({
          draft_id: data.id,
          status: '下書きを更新しました（未送信）',
          preview: draftPreview(input, subject),
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )

  server.tool(
    'gmail_send_draft',
    '下書きを送信する。取り消しできないため、必ず直前に下書きの宛先・件名・本文を利用者に見せ、' +
      '利用者が「送信して」等と明示的に承認した場合にだけ呼ぶこと。承認なしに自分の判断で呼んではいけない。' +
      '商談に紐づくメールならdeal_id/deal_typeを渡すと、商談の活動ログ（deal_actions）に「電話・メール」として記録する。',
    {
      draft_id: z.string().describe('gmail_create_draftで作成した下書きのID'),
      confirmed_by_user: z
        .literal(true)
        .describe('利用者が下書き内容を確認し、送信を明示的に承認した場合のみtrue'),
      deal_id: z.string().optional().describe('活動ログを残す商談のid（deals_tob/deals_toc）'),
      deal_type: z.enum(['tob', 'toc']).optional().describe('deal_idの種別。deal_id指定時は必須'),
    },
    async ({ draft_id, deal_id, deal_type }, extra) => {
      try {
        const email = requireUser(extra)
        if (deal_id && !deal_type) throw new Error('deal_idを指定する場合はdeal_typeも指定してください')
        const gmail = await gmailClientFor(email)

        const { data: draft } = await gmail.users.drafts.get({ userId: 'me', id: draft_id, format: 'metadata' })
        const subject = draft.message ? header(draft.message, 'Subject') : ''
        const to = draft.message ? header(draft.message, 'To') : ''

        const { data: sent } = await gmail.users.drafts.send({ userId: 'me', requestBody: { id: draft_id } })

        let dealLog: unknown = null
        if (deal_id && deal_type) {
          const { data, error } = await mcpSupabaseAdmin
            .from('deal_actions')
            .insert({
              deal_id,
              deal_type,
              member_id: await memberIdFor(email),
              action_type: '電話・メール',
              action_date: todayJST(),
              notes: `メール送信: ${subject}（宛先: ${to}）`,
            })
            .select()
            .single()
          // メール自体は送信済みなので、ログの失敗はエラーにせず結果に添えて返す
          dealLog = error ? { error: `活動ログの記録に失敗しました: ${error.message}` } : data
        }

        return textResult({
          status: '送信しました',
          message_id: sent.id,
          thread_id: sent.threadId,
          subject,
          to,
          deal_action: dealLog,
        })
      } catch (e) {
        return errorResult(messageOf(e))
      }
    }
  )
}
