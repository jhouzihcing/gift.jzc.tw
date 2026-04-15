/**
 * Google Drive JSON File Storage for SGCM
 * ─────────────────────────────────────────────
 * v2：改用 appDataFolder（使用者在 Drive UI 看不到、無法直接刪除）
 *      + AES-256-GCM 加密（以 Google UID 為金鑰種子）
 *
 * 每次寫入只需 1 次 API 呼叫（原子覆寫），大幅提升穩定性。
 */

import { encryptDB, decryptDB } from "./crypto";

const DB_FILENAME = "sgcm-data.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export interface DriveCard {
  id: string;
  merchant: string;
  name: string;
  barcode: string;
  secondaryBarcode: string | null;
  amount: number;
  createdAt: number;
  deletedAt: number | null;
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
 * 在 Drive appDataFolder 中搜尋或建立 sgcm-data.json，回傳其 fileId
 * appDataFolder 為隱藏空間：使用者在 Drive UI 完全看不到，無法手動刪除
 */
export async function getOrCreateDriveFile(
  token: string,
  uid: string
): Promise<string> {
  // 1. 只搜尋 appDataFolder 空間
  const q = `name='${DB_FILENAME}' and trashed=false`;
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=appDataFolder`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!searchRes.ok) throw new Error(`Drive search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // --- 救援邏輯 (Rescue): 若隱藏空間找不到，去根目錄找找看有沒有舊檔案 ---
  // 注意：這需要 https://www.googleapis.com/auth/drive.file 權限
  const qRoot = `name='${DB_FILENAME}' and trashed=false`;
  const rootSearchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(qRoot)}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (rootSearchRes.ok) {
    const rootSearchData = await rootSearchRes.json();
    if (rootSearchData.files?.length > 0) {
      const oldFileId = rootSearchData.files[0].id;
      console.log("[Drive Rescue] 發現根目錄舊檔案，準備搬家至 appDataFolder...");

      try {
        // 1. 讀取舊檔案內容 (相容明文或加密)
        const oldDB = await readDriveDB(token, oldFileId, uid);

        // 2. 在 appDataFolder 建立新的加密檔案
        // 注意：這裡傳入的 DB 物件會被 createNewDriveFile 加密
        const newFileId = await createNewDriveFile(token, uid, typeof oldDB === 'object' && 'db' in oldDB ? (oldDB as any).db : oldDB);

        // 3. 標記舊檔案（可以移動到垃圾桶，但為了安全起見，我們暫時先保留在原地，只需成功搬家即可）
        // 或者我們可以選擇不刪除，讓使用者安心，但搬家成功後 return 新 ID 即可。
        console.log("[Drive Rescue] 搬家成功！新 ID:", newFileId);
        return newFileId;
      } catch (error) {
        console.error("[Drive Rescue] 搬家失敗，將建立全新資料庫:", error);
      }
    }
  }

  // 找不到任何資料，建立全新的 JSON 檔案
  return createNewDriveFile(token, uid, emptyDB());
}

/**
 * 內部輔助函式：在 appDataFolder 建立加密檔案
 */
async function createNewDriveFile(token: string, uid: string, db: DriveDB): Promise<string> {
  const encryptedContent = await encryptDB(db, uid);
  const metadata = {
    name: DB_FILENAME,
    mimeType: "text/plain",
    parents: ["appDataFolder"],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([encryptedContent], { type: "text/plain" }));

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  const created = await res.json();
  return created.id;
}

/**
 * 從 Drive 讀取並解密完整資料庫
 * 回傳值包含 db 本體與用於防衝突的 etag
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB; etag: string }> {
  // 取得 metadata 以獲取 etag
  const metaRes = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=etag`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { etag } = await metaRes.json();

  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Drive read failed: ${res.status}`);

  const ciphertext = await res.text();

  // 相容性處理：若是舊格式（明文 JSON），直接解析後回傳
  if (ciphertext.trimStart().startsWith("{")) {
    console.warn("[Drive] 偵測到未加密的舊格式資料");
    return { db: JSON.parse(ciphertext) as DriveDB, etag };
  }

  // 嚴格模式：若解密失敗，拋出錯誤，不可回傳空資料庫（防止覆寫雲端）
  const db = await decryptDB(ciphertext, uid);
  return { db, etag };
}

/**
 * 加密後寫入 Drive
 * 使用 If-Match 標頭配合 etag，防止覆蓋掉其他裝置的更新
 */
export async function writeDriveDB(
  token: string,
  fileId: string,
  db: DriveDB,
  uid: string,
  etag?: string
): Promise<string> {
  const encryptedContent = await encryptDB(
    { ...db, lastModified: Date.now() },
    uid
  );

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "text/plain",
  };

  // 如果提供 etag，則進行衝突檢查
  if (etag) {
    headers["If-Match"] = etag;
  }

  const res = await fetch(
    `${UPLOAD_API}/files/${fileId}?uploadType=media&fields=etag`,
    {
      method: "PATCH",
      headers,
      body: encryptedContent,
    }
  );

  if (res.status === 412) {
    throw new Error("SYNC_CONFLICT"); // 外部需處理衝突重試
  }

  if (!res.ok) throw new Error(`Drive write failed: ${res.status}`);
  
  const data = await res.json();
  return data.etag; // 回傳新的 etag
}

/**
 * 清除垃圾桶中超過 15 天的卡片（本地操作，不需 API）
 */
export function cleanupTrash(db: DriveDB): { db: DriveDB; changed: boolean } {
  const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const filtered = db.cards.filter(
    (c) => !(c.deletedAt && now - c.deletedAt > FIFTEEN_DAYS)
  );
  return {
    db: { ...db, cards: filtered },
    changed: filtered.length !== db.cards.length,
  };
}
