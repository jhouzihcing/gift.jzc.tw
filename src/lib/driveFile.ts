import { encryptDB, decryptDB } from "./crypto";

const VISIBLE_FILENAME = "zj-card-sync.json";
const OLD_VISIBLE_FILENAME = "zc-card 請勿刪除·此為禮物卡檔案.json";
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
 * 在根目錄搜尋或建立資料檔案 (v2.16.0 純淨顯性版)
 */
export async function getOrCreateDriveFile(
  token: string, 
  uid: string
): Promise<string> {
  const q = `name='${VISIBLE_FILENAME}' and trashed=false`;
  
  // 策略：嘗試兩次搜尋，中間間隔 2 秒，以對抗 Google 索引延遲
  let attempts = 0;
  while (attempts < 2) {
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&t=${Date.now()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Search failed`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    attempts++;
    if (attempts < 2) {
      console.log(`[Drive] 尚未找到檔案，等待 2 秒後由重試搜尋... (Attempt ${attempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 真的沒找到，才建立新檔案
  console.log(`[Drive] 確認無現有檔案，正在建立新同步檔：${VISIBLE_FILENAME}`);
  const encrypted = await encryptDB(emptyDB(), uid);
  const metadata = { 
    name: VISIBLE_FILENAME, 
    mimeType: "text/plain",
    parents: ['root'] // 強制在根目錄建立
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
  return created.id;
}

/**
 * 從指定 File ID 讀取
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB }> {
  // 增加強制快取破除
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
 * 寫入指定 File ID (PATCH)
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
  if (!res.ok) {
    throw new Error(`Write failed: ${res.status}`);
  }
}

/**
 * 舊檔遷移
 */
export async function migrateOldVisibleFile(token: string): Promise<void> {
  try {
    const q = `name='${OLD_VISIBLE_FILENAME}' and trashed=false`;
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&t=${Date.now()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.files?.length > 0) {
      const oldFileId = data.files[0].id;
      await fetch(`${DRIVE_API}/files/${oldFileId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: VISIBLE_FILENAME }),
      });
    }
  } catch {}
}

export function cleanupTrash(db: DriveDB): { db: DriveDB; changed: boolean } {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const before = db.cards.length;
  db.cards = db.cards.filter((c) => !c.deletedAt || c.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== before };
}
