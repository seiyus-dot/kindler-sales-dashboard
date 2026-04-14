import { google } from 'googleapis'

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function createDealFolder(companyName: string): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name: companyName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  const folderId = res.data.id!

  // 作成したフォルダをチーム全員に共有
  const domain = process.env.GOOGLE_DRIVE_SHARE_DOMAIN
  if (domain) {
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: { role: 'writer', type: 'domain', domain },
      })
    } catch (e) {
      console.error('権限付与に失敗しました（フォルダは作成済み）:', e)
    }
  }

  return folderId
}

export async function listFolderFiles(folderId: string) {
  const drive = getDriveClient()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size)',
    orderBy: 'modifiedTime desc',
  })
  return res.data.files ?? []
}

export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  body: NodeJS.ReadableStream
): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: { mimeType, body },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  return res.data.webViewLink!
}
