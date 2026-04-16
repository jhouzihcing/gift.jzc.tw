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
 * 在指定空間搜尋或建立資料檔案
 * @param space 'drive' (根目錄) 或 'appDataFolder' (隱藏)
 */
export async function getOrCreateDriveFile(
  token: string, 
  uid: string, 
  space: 'drive' | 'appDataFolder' = 'drive'
): Promise<string> {
  // 1. 搜尋現有檔案
  const q = `name='${VISIBLE_FILENAME}' and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=${space}&t=${Date.now()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Search failed in ${space}`);
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // 2. 建立新檔案
  const encrypted = await encryptDB(emptyDB(), uid);
  const metadata: any = { 
    name: VISIBLE_FILENAME, 
    mimeType: "text/plain",
  };

  // v2.15.0: 強制路徑定位
  if (space === 'appDataFolder') {
    metadata.parents = ['appDataFolder'];
  } else {
    metadata.parents = ['root']; // 強制在根目錄
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
 * 從指定 File ID 讀取
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB; lastModifiedTime: number }> {
  // 獲取檔案中繼資料以取得真實修改時間
  const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=modifiedTime`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let lastModifiedTime = 0;
  if (metaRes.ok) {
    const meta = await metaRes.json();
    lastModifiedTime = new Date(meta.modifiedTime).getTime();
  }

  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);

  const ciphertext = await res.text();

  if (ciphertext.trimStart().startsWith("{")) {
    return { db: JSON.parse(ciphertext) as DriveDB, lastModifiedTime };
  }
  return { db: await decryptDB(ciphertext, uid), lastModifiedTime };
}

/**
 * 寫入指定 File ID
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
 * 舊檔遷移 (僅限根目錄)
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
