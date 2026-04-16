import { encryptDB, decryptDB } from "./crypto";

export const VISIBLE_FILENAME = "zj-card-sync.json";
export const PRIVATE_FILENAME = "zj-card-private-sync.json"; // v2.18.0 新增隱藏空間專用名

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export type DriveCardStatus = "Active" | "Trashed" | "Empty";

export interface DriveCard {
  id: string;
  merchant: string;
  name: string;
  barcode: string;
  secondaryBarcode: string | null;
  amount: number;
  createdAt: number;
  deletedAt: number | null;
  status: DriveCardStatus;
}

export interface DriveDB {
  version: number;
  lastModified: number;
  cards: DriveCard[];
  customMerchants: string[];
}

const emptyDB = (): DriveDB => ({
  version: 1,
  lastModified: Date.now(),
  cards: [],
  customMerchants: [],
});

/**
 * 搜尋或建立資料檔案 (v2.18.0 支援雙空間與絕對校驗)
 */
export async function getOrCreateDriveFile(
  token: string, 
  uid: string,
  space: 'drive' | 'appDataFolder' = 'drive'
): Promise<string> {
  const fileName = space === 'drive' ? VISIBLE_FILENAME : PRIVATE_FILENAME;
  const q = `name='${fileName}' and trashed=false`;
  
  let attempts = 0;
  while (attempts < 2) {
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)&spaces=${space}&t=${Date.now()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Search failed in ${space}`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      const sorted = data.files.sort((a: any, b: any) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );
      return sorted[0].id;
    }

    attempts++;
    if (attempts < 2) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // 若沒影，則建立
  const encrypted = await encryptDB(emptyDB(), uid);
  const metadata: any = { 
    name: fileName, 
    mimeType: "text/plain",
  };
  
  if (space === 'drive') {
    metadata.parents = ['root'];
  } else {
    metadata.parents = ['appDataFolder'];
  }

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([encrypted], { type: "text/plain" }));

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!createRes.ok) throw new Error(`Create failed in ${space}`);
  const created = await createRes.json();
  return created.id;
}

/**
 * 讀取資料
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB }> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);

  const ciphertext = await res.text();

  if (ciphertext.trimStart().startsWith("{")) {
    return { db: JSON.parse(ciphertext) as DriveDB };
  }
  return { db: await decryptDB(ciphertext, uid) };
}

/**
 * 寫入資料
 */
export async function writeDriveDB(
  token: string,
  fileId: string,
  db: DriveDB,
  uid: string
): Promise<void> {
  const encrypted = await encryptDB({ ...db, lastModified: Date.now() }, uid);
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: encrypted,
  });
  if (!res.ok) throw new Error(`Write failed: ${res.status}`);
}

export function cleanupTrash(db: DriveDB): { db: DriveDB; changed: boolean } {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const before = db.cards.length;
  db.cards = db.cards.filter((c) => !c.deletedAt || c.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== before };
}
