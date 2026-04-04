import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

// =============================================
// Types
// =============================================

export type Member = {
  id: string
  name: string
  sort_order: number
}

export type DealStatus_ToB =
  | '初回接触' | 'ヒアリング' | '提案中' | '見積提出'
  | 'クロージング' | '受注' | '失注' | '保留'

export type DealStatus_ToC =
  | '相談予約' | 'ヒアリング' | '提案中' | 'クロージング'
  | '受注' | '失注' | '保留'

export type Priority = '高' | '中' | '低'

export type DealToB = {
  id: string
  member_id?: string
  company_name: string
  contact_name?: string
  industry?: string
  status?: DealStatus_ToB
  priority?: Priority
  first_contact_date?: string
  last_contact_date?: string
  expected_amount?: number
  win_probability?: number
  source?: string
  service?: string
  next_action?: string
  next_action_date?: string
  notes?: string
  payment_date?: string
  actual_amount?: number
  loss_reason?: string
  loss_detail?: string
  sub_member_id?: string
  deal_type?: 'spot' | 'subscription'
  monthly_amount?: number
  contract_start?: string
  contract_end?: string
  payment_status?: string
  payment_error_date?: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  created_at: string
  updated_at: string
  member?: Member
  sub_member?: Member
}

export type DealToC = {
  id: string
  member_id?: string
  name: string
  contact?: string
  source?: string
  status?: DealStatus_ToC
  priority?: Priority
  first_contact_date?: string
  last_contact_date?: string
  service?: string
  expected_amount?: number
  win_probability?: number
  next_action?: string
  next_action_date?: string
  notes?: string
  payment_date?: string
  actual_amount?: number
  loss_reason?: string
  loss_detail?: string
  sub_member_id?: string
  deal_type?: 'spot' | 'subscription'
  monthly_amount?: number
  contract_start?: string
  contract_end?: string
  payment_status?: string
  payment_error_date?: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  created_at: string
  updated_at: string
  member?: Member
  sub_member?: Member
}

export type DealAction = {
  id: string
  deal_id: string
  deal_type: 'tob' | 'toc'
  member_id?: string
  action_type: string
  action_date: string
  notes?: string
  created_at: string
  member?: Member
}

export const ACTION_TYPES = ['初回接触', '電話・メール', '商談', '提案', '見積提出', 'クロージング', 'フォロー', 'その他'] as const
export const LOSS_REASONS = ['価格', '競合他社', 'タイミング', 'ニーズ不一致', '予算不足', '社内決裁', 'その他'] as const

export type MasterOption = {
  id: string
  type: string
  value: string
  sort_order: number
}

export type ColumnConfig = {
  id: string
  table_type: 'tob' | 'toc'
  column_key: string
  label: string
  visible: boolean
  sort_order: number
}

export type WeeklyLog = {
  id: string
  log_date: string
  tob_count: number
  toc_count: number
  tob_amount: number
  toc_amount: number
  weighted_total: number
  cumulative_orders: number
  memo?: string
}
