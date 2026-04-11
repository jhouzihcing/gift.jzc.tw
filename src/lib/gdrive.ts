const BACKUP_FILENAME = "sgcm_backup_2026.json";

export async function findBackupFile(token: string) {
  const q = `name = '${BACKUP_FILENAME}' and trashed = false`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

export async function uploadBackup(token: string, content: any, fileId?: string) {
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: "application/json",
  };

  const body = new FormData();
  body.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  body.append(
    "file",
    new Blob([JSON.stringify(content)], { type: "application/json" })
  );

  let url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  let method = "POST";

  if (fileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
    method = "PATCH";
  }

  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  return await response.json();
}

export async function downloadBackup(token: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) return null;
  return await response.json();
}
