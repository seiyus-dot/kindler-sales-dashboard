import { NextRequest, NextResponse } from 'next/server'
import { uploadFileToDrive } from '@/lib/google-drive'
import { Readable } from 'stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    const folderId = form.get('folderId') as string
    if (!file || !folderId) return NextResponse.json({ error: 'fileとfolderIdが必要です' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const stream = Readable.from(buffer)
    const url = await uploadFileToDrive(folderId, file.name, file.type, stream)
    return NextResponse.json({ url })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
