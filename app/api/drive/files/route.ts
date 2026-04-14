import { NextRequest, NextResponse } from 'next/server'
import { listFolderFiles } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  try {
    const folderId = req.nextUrl.searchParams.get('folderId')
    if (!folderId) return NextResponse.json({ error: 'folderIdが必要です' }, { status: 400 })
    const files = await listFolderFiles(folderId)
    return NextResponse.json({ files })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
