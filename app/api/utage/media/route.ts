import { NextRequest, NextResponse } from 'next/server'
import { getVideos, getAudios } from '@/lib/utage'

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? 'video'
    const page = Number(req.nextUrl.searchParams.get('page') ?? 1)

    const data = type === 'audio' ? await getAudios(page) : await getVideos(page)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
