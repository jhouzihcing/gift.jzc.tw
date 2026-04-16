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
 * 偵測隱藏空間中的所有檔案 (Nuclear Search Debug)
 */
export async function listAllAppDataFiles(token: string): Promise<{ id: string, name: string, modifiedTime: string }[]> {
  const res = await fetch(
    `${DRIVE_API}/files?fields=files(id,name,modifiedTime)&spaces=appDataFolder&t=${Date.now()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

/**
 * 搜尋或建立資料檔案
 */
export async function getOrCreateDriveFile(
  token: string, 
  uid: string,
  space: 'drive' | 'appDataFolder' = 'drive',
  logFn?: (msg: string) => void
): Promise<string> {
  const fileName = space === 'drive' ? VISIBLE_FILENAME : PRIVATE_FILENAME;
  const q = `name='${fileName}' and trashed=false`;
  
  logFn?.(`🔍 正在 ${space} 搜尋檔案: ${fileName}...`);

  let attempts = 0;
  while (attempts < 2) {
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)&spaces=${space}&t=${Date.now()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      logFn?.(`❌ 搜尋失敗 (HTTP ${res.status})`);
      throw new Error(`Search failed in ${space}`);
    }
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      const sorted = data.files.sort((a: any, b: any) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );
      logFn?.(`✅ 找到 ${sorted.length} 個同名檔案，鎖定 ID: ${sorted[0].id}`);
      return sorted[0].id;
    }

    attempts++;
    if (attempts < 2) {
      logFn?.(`⏳ 未發現檔案，1.5秒後重試搜尋...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // Nuclear Search
  if (space === 'appDataFolder') {
    logFn?.(`⚠️ 常規搜尋失敗，啟動全域掃描...`);
    const allFiles = await listAllAppDataFiles(token);
    if (allFiles.length > 0) {
      logFn?.(`📢 全域發現 ${allFiles.length} 個隱藏檔案，但無目標名稱。`);
    }
  }

  logFn?.(`🆕 確定無現有檔案，正在建立新同步檔...`);
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
  logFn?.(`✨ 新檔案建立成功！ID: ${created.id}`);
  return created.id;
}

/**
 * 讀取資料 (v2.21.0 支援雙金鑰校對)
 * @param fallbackUid 通常傳入 user.email
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  uid: string,
  logFn?: (msg: string) => void,
  fallbackUid?: string
): Promise<{ db: DriveDB }> {
  logFn?.(`📡 正在從雲端抓取原始數據 (ID: ${fileId.slice(0, 8)})...`);
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    logFn?.(`❌ 雲端抓取失敗 (HTTP ${res.status})`);
    throw new Error(`Read failed: ${res.status}`);
  }

  const ciphertext = await res.text();
  
  // 1. 如果是明文，直接返回
  if (ciphertext.trimStart().startsWith("{")) {
    logFn?.(`🔓 偵測為明文 JSON，直接解析。`);
    return { db: JSON.parse(ciphertext) as DriveDB };
  }

  // 2. 嘗試主要 UID 解密
  try {
    logFn?.(`🔓 嘗試使用系統 ID 進行解密...`);
    const decrypted = await decryptDB(ciphertext, uid);
    logFn?.(`✅ 系統 ID 解密成功！數據內含 ${decrypted.cards.length} 張卡片。`);
    return { db: decrypted };
  } catch (e) {
    logFn?.(`⚠️ 系統 ID 解密失敗，嘗試使用 Email 作為救援金鑰...`);
    
    // 3. Fallback: 使用 Email (fallbackUid) 解密
    if (fallbackUid) {
       try {
         const decryptedFallback = await decryptDB(ciphertext, fallbackUid);
         logFn?.(`✅ Email 救援成功！已成功找回跨裝置資料。`);
         return { db: decryptedFallback };
       } catch (fe) {
         logFn?.(`🔥 本帳號所有金鑰皆無法解開此密文，請確認是否為同一個 Google 帳號。`);
         throw fe;
       }
    } else {
       logFn?.(`🔥 無可用的救援金鑰，解密中斷。`);
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
  uid: string,
  logFn?: (msg: string) => void
): Promise<void> {
  logFn?.(`🚀 加密並寫入雲端...`);
  const encrypted = await encryptDB({ ...db, lastModified: Date.now() }, uid);
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: encrypted,
  });
  if (!res.ok) {
    logFn?.(`❌ 雲端寫入失敗 (HTTP ${res.status})`);
    throw new Error(`Write failed: ${res.status}`);
  }
  logFn?.(`✅ 雲端寫入成功。`);
}

export function cleanupTrash(db: DriveDB): { db: DriveDB; changed: boolean } {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const before = db.cards.length;
  db.cards = db.cards.filter((c) => !c.deletedAt || c.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== before };
}
