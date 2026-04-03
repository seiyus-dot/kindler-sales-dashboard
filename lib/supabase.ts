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
  member_id: string
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
  created_at: string
  updated_at: string
  members?: Member
}

export type DealToC = {
  id: string
  member_id: string
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
  created_at: string
  updated_at: string
  members?: Member
}

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
