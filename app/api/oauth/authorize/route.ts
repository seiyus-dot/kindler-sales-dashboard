/**
 * OAuth 2.0 Authorization Endpoint
 *
 * GET  : 接続キー（＝MCP_AUTH_TOKENSの共有シークレット）を入力させる画面を返す
 * POST : 入力されたキーを照合し、正しければ認可コードを付けて redirect_uri に戻す
 *
 * 接続方法は2つ。
 * - Googleアカウントで接続（/api/oauth/google/*）: 営業メンバー個人として接続し、本人のGmailも使える。
 *   actorはメールアドレス。GOOGLE_OAUTH_CLIENT_ID 等が未設定ならボタン自体を出さない。
 * - 接続キー: MCP_AUTH_TOKENS の共有シークレット。誰の接続かはキーのラベルでしか分からず、Gmailは使えない。
 */
import {
  resolveSharedSecretActor,
  issueAuthorizationCode,
  allowedSharedSecrets,
  isAcceptableRedirectUri,
} from '@/lib/mcp-oauth'
import { isGoogleLoginConfigured } from '@/lib/gmail-auth'

export const dynamic = 'force-dynamic'

function escapeHtml(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function page(args: {
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
  error?: string
}): Response {
  const host = (() => {
    try {
      return new URL(args.redirectUri).host
    } catch {
      return args.redirectUri
    }
  })()

  const googleHref = `/api/oauth/google/start?${new URLSearchParams({
    redirect_uri: args.redirectUri,
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: args.codeChallengeMethod,
  }).toString()}`
  const googleBlock = isGoogleLoginConfigured()
    ? `<a class="google" href="${escapeHtml(googleHref)}">Googleアカウントで接続（営業メンバー）</a>
    <p class="note" style="margin:10px 0 0">自分のGmailでメールの下書き作成・送信・検索ができるようになります。</p>
    <div class="divider"><span>または接続キーで接続</span></div>`
    : ''

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MCP接続の許可 | KINDLER</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #f4f6fb; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif;
    color: #1f2937;
  }
  .card {
    width: 100%; max-width: 420px; background: #fff; border-radius: 14px;
    padding: 32px; box-shadow: 0 8px 32px rgba(26, 58, 110, .10);
  }
  h1 { margin: 0 0 8px; font-size: 20px; color: #1a3a6e; }
  p { margin: 0 0 20px; font-size: 13px; line-height: 1.7; color: #4b5563; }
  .host { font-weight: 700; color: #1a3a6e; }
  label { display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
  input {
    width: 100%; padding: 11px 13px; border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  input:focus { outline: none; border-color: #1a3a6e; box-shadow: 0 0 0 3px rgba(26,58,110,.12); }
  button {
    width: 100%; margin-top: 18px; padding: 12px; border: 0; border-radius: 8px;
    background: #1a3a6e; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  }
  button:hover { background: #16305c; }
  .error {
    background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
    padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
  }
  .google {
    display: block; width: 100%; padding: 12px; border-radius: 8px; text-align: center;
    background: #fff; color: #1a3a6e; border: 1.5px solid #1a3a6e;
    font-size: 15px; font-weight: 700; text-decoration: none;
  }
  .google:hover { background: #f0f4ff; }
  .divider { display: flex; align-items: center; gap: 10px; margin: 22px 0 18px; font-size: 11px; color: #9ca3af; }
  .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: #e5e7eb; }
  .note { margin: 18px 0 0; font-size: 11px; color: #9ca3af; line-height: 1.6; }
</style>
</head>
<body>
  <form class="card" method="post">
    <h1>MCP接続の許可</h1>
    <p><span class="host">${escapeHtml(host)}</span> から KINDLER 営業ダッシュボードへの接続が要求されています。許可する場合は${googleBlock ? '、Googleアカウントでログインするか' : ''}接続キーを入力してください。</p>
    ${args.error ? `<div class="error">${escapeHtml(args.error)}</div>` : ''}
    ${googleBlock}
    <label for="secret">接続キー</label>
    <!--
      type="password" + autocomplete="off" だとブラウザのパスワードマネージャが
      無関係な保存済みパスワードを勝手に入れてしまい、「接続キーが違います」の
      原因になる。new-password と各マネージャの無効化属性で抑止する。
    -->
    <input id="secret" name="secret" type="password" autocomplete="new-password" autofocus required
           data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other"
           placeholder="MCP_AUTH_TOKENS の値">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(args.redirectUri)}">
    <input type="hidden" name="state" value="${escapeHtml(args.state)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(args.codeChallenge)}">
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(args.codeChallengeMethod)}">
    <button type="submit">接続を許可する</button>
    <p class="note">このキーを持つクライアントは、商談・契約・顧客マスタおよびマネーフォワードの請求データにアクセスできます。</p>
  </form>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export function GET(req: Request) {
  const url = new URL(req.url)
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const responseType = url.searchParams.get('response_type') ?? 'code'

  if (!isAcceptableRedirectUri(redirectUri)) {
    return new Response('redirect_uri が不正です', { status: 400 })
  }
  if (responseType !== 'code') {
    // エラーはredirect_uri側に返すのがOAuthの作法
    const back = new URL(redirectUri)
    back.searchParams.set('error', 'unsupported_response_type')
    const state = url.searchParams.get('state')
    if (state) back.searchParams.set('state', state)
    return Response.redirect(back.toString(), 302)
  }

  return page({
    redirectUri,
    state: url.searchParams.get('state') ?? '',
    codeChallenge: url.searchParams.get('code_challenge') ?? '',
    codeChallengeMethod: url.searchParams.get('code_challenge_method') ?? 'S256',
  })
}

export async function POST(req: Request) {
  const form = await req.formData()
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const state = String(form.get('state') ?? '')
  const codeChallenge = String(form.get('code_challenge') ?? '')
  const codeChallengeMethod = String(form.get('code_challenge_method') ?? 'S256')
  // 環境変数側は allowedSharedSecrets() で trim 済み。入力側もそろえないと、
  // コピペで前後に空白や改行が混ざっただけで「キーが違います」になってしまう。
  const secret = String(form.get('secret') ?? '').trim()

  if (!isAcceptableRedirectUri(redirectUri)) {
    return new Response('redirect_uri が不正です', { status: 400 })
  }

  if (allowedSharedSecrets().length === 0) {
    return page({
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      error: 'サーバー側で MCP_AUTH_TOKENS が未設定のため接続できません。管理者に連絡してください。',
    })
  }

  const actor = resolveSharedSecretActor(secret)
  if (!actor) {
    return page({
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      error: '接続キーが違います。',
    })
  }

  const code = issueAuthorizationCode({ redirectUri, codeChallenge, codeChallengeMethod, actor })
  const back = new URL(redirectUri)
  back.searchParams.set('code', code)
  if (state) back.searchParams.set('state', state)
  return Response.redirect(back.toString(), 302)
}
