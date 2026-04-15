/**
 * Google Drive JSON File Storage for SGCM
 * ─────────────────────────────────────────────
 * v2：改用 appDataFolder（使用者在 Drive UI 看不到、無法直接刪除）
 *      + AES-256-GCM 加密（以 Google UID 為金鑰種子）
 *
 * 每次寫入只需 1 次 API 呼叫（原子覆寫），大幅提升穩定性。
 */

import { encryptDB, decryptDB } from "./crypto";

const HIDDEN_FILENAME = "sgcm-data.json";
const VISIBLE_FILENAME = "zc-card 請勿刪除·此為禮物卡檔案.json";
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

export interface DriveFileIds {
  hiddenId: string | null;
  visibleId: string | null;
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
/**
 * 同時在隱藏空間與根目錄搜尋資料檔案
 */
export async function getOrCreateDriveFiles(
  token: string,
): Promise<DriveFileIds> {
  // 1. 搜尋 appDataFolder (HIDDEN)
  const qHidden = `name='${HIDDEN_FILENAME}' and trashed=false`;
  const hiddenRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(qHidden)}&fields=files(id)&spaces=appDataFolder`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // 2. 搜尋根目錄 (VISIBLE)
  const qVisible = `name='${VISIBLE_FILENAME}' and trashed=false`;
  const visibleRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(qVisible)}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const [hData, vData] = await Promise.all([
    hiddenRes.ok ? hiddenRes.json() : Promise.resolve({ files: [] }),
    visibleRes.ok ? visibleRes.json() : Promise.resolve({ files: [] }),
  ]);

  return {
    hiddenId: hData.files?.[0]?.id || null,
    visibleId: vData.files?.[0]?.id || null,
  };
}

/**
 * 建立新檔案的通用函式
 */
export async function createDriveFile(
  token: string,
  uid: string,
  db: DriveDB,
  space: "appDataFolder" | "drive",
  filename: string
): Promise<string> {
  const encryptedContent = await encryptDB(db, uid);
  const metadata = {
    name: filename,
    mimeType: "text/plain",
    parents: [space],
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
 * 從指定 ID 讀取並解密資料庫
 */
export async function readDriveFile(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB; etag: string }> {
  // 1. 下載內容
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Cloud Read Failed: HTTP ${res.status}`);
  }

  // 嘗試獲取 ETag
  let cloudEtag = res.headers.get("ETag") || res.headers.get("etag") || "";
  cloudEtag = cloudEtag.replace(/^W\//, "").replace(/"/g, "");

  if (!cloudEtag) {
    const metaRes = await fetch(
      `${DRIVE_API}/files/${fileId}?fields=etag`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      cloudEtag = meta.etag?.replace(/"/g, "") || "";
    }
  }

  const ciphertext = await res.text();

  // 相容性：舊格式
  if (ciphertext.trimStart().startsWith("{")) {
    return { db: JSON.parse(ciphertext) as DriveDB, etag: cloudEtag };
  }

  try {
    const db = await decryptDB(ciphertext, uid);
    return { db, etag: cloudEtag };
  } catch (error) {
    console.error(`[Drive] Decryption failed for ${fileId}:`, error);
    throw new Error("DECRYPTION_FAILED");
  }
}

/**
 * 加密並寫入單個檔案
 */
export async function writeDriveFile(
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
    throw new Error("SYNC_CONFLICT");
  }

  if (!res.ok) throw new Error(`Drive write failed: ${res.status}`);
  
  const data = await res.json();
  return data.etag?.replace(/"/g, "") || "";
}

/**
 * 雙重保險讀取：同時讀取兩個位置，並以最新的資料為標竿
 * 如果一方缺失，會在後續流程中自動修復（由呼叫者處理）
 */
export async function readDualDB(
  token: string,
  uid: string,
  ids: DriveFileIds
): Promise<{
  db: DriveDB;
  hiddenEtag: string;
  visibleEtag: string;
  needsRepair: boolean;
}> {
  const tasks: Promise<any>[] = [];
  if (ids.hiddenId) tasks.push(readDriveFile(token, ids.hiddenId, uid).catch(() => null));
  else tasks.push(Promise.resolve(null));

  if (ids.visibleId) tasks.push(readDriveFile(token, ids.visibleId, uid).catch(() => null));
  else tasks.push(Promise.resolve(null));

  const [hRes, vRes] = await Promise.all(tasks);

  const hDB = hRes?.db;
  const vDB = vRes?.db;

  // 決定使用哪份資料 (以 lastModified 較大者為準)
  let finalDB: DriveDB | null = null;
  
  if (hDB && vDB) {
    finalDB = hDB.lastModified >= vDB.lastModified ? hDB : vDB;
  } else {
    finalDB = hDB || vDB || null;
  }

  // 如果完全沒資料，初始化一個空的
  const db = finalDB || emptyDB();
  
  // 檢查是否需要修補 (一方有，另一方無；或者其中一方讀取失敗)
  const needsRepair = !hRes || !vRes;

  return {
    db,
    hiddenEtag: hRes?.etag || "",
    visibleEtag: vRes?.etag || "",
    needsRepair
  };
}

/**
 * 雙重保險寫入：同時寫進隱藏空間與根目錄 (容錯版本)
 */
export async function writeDualDB(
  token: string,
  uid: string,
  ids: DriveFileIds,
  db: DriveDB,
  etags: { hidden?: string; visible?: string }
): Promise<{ hiddenEtag: string; visibleEtag: string }> {
  const tasks: { type: "hidden" | "visible"; promise: Promise<string> }[] = [];
  
  if (ids.hiddenId) {
    tasks.push({ 
      type: "hidden", 
      promise: writeDriveFile(token, ids.hiddenId, db, uid, etags.hidden) 
    });
  }

  if (ids.visibleId) {
    tasks.push({ 
      type: "visible", 
      promise: writeDriveFile(token, ids.visibleId, db, uid, etags.visible) 
    });
  }

  if (tasks.length === 0) return { hiddenEtag: "", visibleEtag: "" };

  const results = await Promise.allSettled(tasks.map(t => t.promise));
  
  let newHiddenEtag = etags.hidden || "";
  let newVisibleEtag = etags.visible || "";
  let successCount = 0;
  let conflictError = null;

  results.forEach((result, index) => {
    const taskType = tasks[index].type;
    if (result.status === "fulfilled") {
      successCount++;
      if (taskType === "hidden") newHiddenEtag = result.value;
      else if (taskType === "visible") newVisibleEtag = result.value;
    } else {
      console.warn(`[Drive Resilient Write] ${taskType} side failed:`, result.reason);
      if (result.reason?.message === "SYNC_CONFLICT") {
        conflictError = result.reason;
      }
    }
  });

  // 如果有任何一方發生衝突 (412)，必須拋出衝突錯誤，讓外部進行讀取-合併-重試
  if (conflictError) throw conflictError;

  // 只要有一方寫入成功，就不拋錯，判定為「韌性成功」
  if (successCount > 0) {
    return { hiddenEtag: newHiddenEtag, visibleEtag: newVisibleEtag };
  }

  // 全部失敗才爆開
  throw new Error("ALL_SYNC_LOCATIONS_FAILED");
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
