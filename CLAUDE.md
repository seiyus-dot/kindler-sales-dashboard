# KINDLER 営業見込み管理アプリ

## プロジェクト概要

KINDLERの営業チーム（6名）が使う社内営業管理ツール。
週次定例会議でのパイプライン確認・案件入力・KPIトラッキングが目的。

**技術スタック**
- Next.js (App Router)
- Supabase (PostgreSQL + Auth予定)
- Tailwind CSS
- Recharts（チャート）

---

## ディレクトリ構成

```
app/
  layout.tsx          # サイドバー込みの共通レイアウト
  globals.css         # Tailwindベース + .inputクラス定義
  dashboard/
    page.tsx          # KPI・チャート・サマリ（全体概況）
  deals/
    page.tsx          # toB/toC案件一覧・CRUD
  weekly/
    page.tsx          # 週次ログ記録・閲覧

components/
  DealToBForm.tsx     # toB案件 新規追加・編集モーダル
  DealToCForm.tsx     # toC案件 新規追加・編集モーダル

lib/
  supabase.ts         # Supabaseクライアント + 全型定義
```

---

## データベース設計（Supabase）

### テーブル一覧

| テーブル | 用途 |
|---|---|
| `members` | 担当者マスタ（門脇・白岩・佐々木・宮瀬・稲葉・髙橋） |
| `deals_tob` | toB（法人）案件 |
| `deals_toc` | toC（個人）案件 |
| `weekly_logs` | 週次KPIログ（定例会議後に手入力） |

### 型定義の場所

全型は `lib/supabase.ts` に集約。新しいフィールドを追加するときはここを必ず更新する。

```ts
// 主な型
Member
DealToB
DealToC
WeeklyLog
DealStatus_ToB   // ステータスのunion型
DealStatus_ToC
Priority         // '高' | '中' | '低'
```

### deals_tob の主要カラム

| カラム | 型 | 備考 |
|---|---|---|
| member_id | uuid | members.id への外部キー |
| company_name | text | 必須 |
| status | text | 初回接触/ヒアリング/提案中/見積提出/クロージング/受注/失注/保留 |
| expected_amount | int | 単位：万円 |
| win_probability | int | 0〜100（%） |

### deals_toc の主要カラム

| カラム | 型 | 備考 |
|---|---|---|
| member_id | uuid | members.id への外部キー |
| name | text | 必須 |
| status | text | 相談予約/ヒアリング/提案中/クロージング/受注/失注/保留 |
| service | text | 検討サービス（AI CAMPなど） |
| win_probability | int | 0〜100（%） |

### 加重パイプライン計算

`weekly_logs.weighted_total` は現状手入力。
将来的には `deals_tob` と `deals_toc` から `expected_amount × win_probability / 100` を自動集計する。

---

## 共通ルール

### フォームモーダル
- `DealToBForm` / `DealToCForm` は `initial` propがnullなら新規、あればUPDATE
- Supabaseへの保存は `upsert` ではなく `insert` / `update` を明示的に使い分ける
- 必須バリデーション（担当者・企業名/氏名）はフロント側でチェック

### データフェッチ
- 各ページの `fetchAll()` で全データをまとめて取得
- ページをまたいだ状態共有はしない（各ページで独立してfetch）
- Supabaseのselectでは必ず `members(name)` をjoinして担当者名を取得する

```ts
supabase.from('deals_tob').select('*, members(name)')
```

### スタイル
- 背景は白（`bg-white`）ベース、アクセントは `blue-600`
- 絵文字はUI内で使用しない
- インプット要素は `.input` クラスを使う（`globals.css` で定義）
- ステータスバッジの色分けルール：
  - 受注 → `bg-green-100 text-green-700`
  - 失注 → `bg-red-100 text-red-600`
  - クロージング/見積提出 → `bg-blue-100 text-blue-700`
  - 保留 → `bg-amber-100 text-amber-700`

---

## 今後の拡張予定

- [ ] Supabase Auth でメンバーごとのログイン
- [ ] 加重パイプラインのDB自動集計（deals_tob/tocから計算）
- [ ] 担当者ごとのマイページ（自分の案件のみ表示）
- [ ] 次回期日が近い案件のアラート表示
- [ ] Vercelへのデプロイ

---

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`.env.local` に記載。gitにはコミットしない。

---

## セットアップ

```bash
npm install
npm install @supabase/supabase-js recharts
cp .env.local.example .env.local
# .env.localにSupabaseの値をセット
npm run dev
```

Supabaseのスキーマは `schema.sql` をSQL Editorで実行。
