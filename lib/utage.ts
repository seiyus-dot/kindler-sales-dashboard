const UTAGE_BASE_URL = 'https://api.utage-system.com/v1'

function getApiKey() {
  const key = process.env.UTAGE_API_KEY
  if (!key) throw new Error('UTAGE_API_KEY が設定されていません')
  return key
}

async function utageRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${UTAGE_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(error?.error?.message ?? `HTTPエラー: ${res.status}`)
  }

  return res.json()
}

// ---- ファネル ----

export type Funnel = {
  id: string
  name: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export type PaginatedResponse<T> = {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export function getFunnels(page = 1): Promise<PaginatedResponse<Funnel>> {
  return utageRequest(`/funnels?page=${page}&per_page=50`)
}

export type Step = {
  id: string
  name: string
  [key: string]: unknown
}

export function getSteps(funnelId: string): Promise<PaginatedResponse<Step>> {
  return utageRequest(`/funnels/${funnelId}/steps`)
}

// ---- 配信アカウント ----

export type Account = {
  id: string
  name: string
  type: string
  [key: string]: unknown
}

export function getAccounts(page = 1): Promise<PaginatedResponse<Account>> {
  return utageRequest(`/accounts?page=${page}&per_page=50`)
}

export type Scenario = {
  id: string
  name: string
  [key: string]: unknown
}

export function getScenarios(accountId: string): Promise<PaginatedResponse<Scenario>> {
  return utageRequest(`/accounts/${accountId}/scenarios`)
}

// ---- メディア ----

export type MediaItem = {
  id: string
  name: string
  url?: string
  duration?: number
  [key: string]: unknown
}

export function getVideos(page = 1): Promise<PaginatedResponse<MediaItem>> {
  return utageRequest(`/media/videos?page=${page}&per_page=50`)
}

export function getAudios(page = 1): Promise<PaginatedResponse<MediaItem>> {
  return utageRequest(`/media/audios?page=${page}&per_page=50`)
}
