import { encryptDB, decryptDB } from "./crypto";

export const VISIBLE_FILENAME = "zj-card-sync.json";
export const PRIVATE_FILENAME = "zj-card-private-sync.json"; 

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
 * 搜尋或建立資料檔案 (v2.23.0 統一使用 Email)
 */
export async function getOrCreateDriveFile(
  token: string, 
  keySeed: string,
  space: 'drive' | 'appDataFolder' = 'drive',
  logFn?: (msg: string) => void
): Promise<string> {
  const fileName = space === 'drive' ? VISIBLE_FILENAME : PRIVATE_FILENAME;
  const q = `name='${fileName}' and trashed=false`;
  
  logFn?.(`🔍 搜尋雲端同步檔: ${fileName}...`);

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
    logFn?.(`✅ 已備妥雲端存取。`);
    return sorted[0].id;
  }

  logFn?.(`🆕 建立新同步檔...`);
  const encrypted = await encryptDB(emptyDB(), keySeed);
  const metadata: any = { 
    name: fileName, 
    mimeType: "text/plain",
    parents: [space === 'drive' ? 'root' : 'appDataFolder']
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([encrypted], { type: "text/plain" }));

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!createRes.ok) throw new Error(`Create failed`);
  const created = await createRes.json();
  logFn?.(`✨ 雲端存取初始化完成。`);
  return created.id;
}

/**
 * 讀取並解密 (v2.23.0 階層：Email 優先 -> UID 備索)
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  email: string,
  logFn?: (msg: string) => void,
  legacyUid?: string
): Promise<{ db: DriveDB, keyMigrated: boolean }> {
  logFn?.(`📡 抓取數據中...`);
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);

  const ciphertext = await res.text();
  
  // 1. 直接解析明文 (如有)
  if (ciphertext.trimStart().startsWith("{")) {
    return { db: JSON.parse(ciphertext) as DriveDB, keyMigrated: true };
  }

  // 2. 優先使用 Email 解密 (v2.23.0 標準)
  try {
    const decrypted = await decryptDB(ciphertext, email);
    logFn?.(`✅ 解析成功 (採用帳號本機金鑰)。`);
    return { db: decrypted, keyMigrated: false };
  } catch (e) {
    // 3. Fallback: 使用舊版 UID 解密
    if (legacyUid) {
       try {
         const decryptedLegacy = await decryptDB(ciphertext, legacyUid);
         logFn?.(`🩹 已透過舊版金鑰找回資料，啟動自動格式更新...`);
         return { db: decryptedLegacy, keyMigrated: true };
       } catch (fe) {
         logFn?.(`🔥 無法解析資料。請確認帳號是否一致。`);
         throw fe;
       }
    } else {
       throw e;
    }
  }
}

/**
 * 寫入資料
 */
export async function writeDriveDB(
  token: string,
  fileId: string,
  db: DriveDB,
  keySeed: string,
  logFn?: (msg: string) => void
): Promise<void> {
  logFn?.(`🚀 同步至雲端...`);
  const encrypted = await encryptDB({ ...db, lastModified: Date.now() }, keySeed);
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: encrypted,
  });
  if (!res.ok) throw new Error(`Write failed`);
  logFn?.(`✅ 同步成功。`);
}

export function cleanupTrash(db: DriveDB): { db: DriveDB; changed: boolean } {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const before = db.cards.length;
  db.cards = db.cards.filter((c) => !c.deletedAt || c.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== before };
}
