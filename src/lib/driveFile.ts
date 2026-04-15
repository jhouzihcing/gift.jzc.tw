import { encryptDB, decryptDB } from "./crypto";

const HIDDEN_FILENAME = "sgcm-data.json";
const VISIBLE_FILENAME = "zj-card-sync.json";
const OLD_VISIBLE_FILENAME = "zc-card 請勿刪除·此為禮物卡檔案.json";
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
 * 遷移舊的中文檔名至新格式
 */
export async function migrateOldVisibleFile(token: string): Promise<void> {
  try {
    const q = `name='${OLD_VISIBLE_FILENAME}' and trashed=false`;
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.files?.length > 0) {
      const oldFileId = data.files[0].id;
      console.log(`[Drive Migration] Found old file ${oldFileId}, renaming...`);
      await fetch(`${DRIVE_API}/files/${oldFileId}`, {
        method: "PATCH",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: VISIBLE_FILENAME })
      });
      console.log("[Drive Migration] Rename successful.");
    }
  } catch (error) {
    console.error("[Drive Migration] Failed:", error);
  }
}

/**
 * 同時在隱藏空間與根目錄搜尋資料檔案
 */
export async function getOrCreateDriveFiles(token: string): Promise<DriveFileIds> {
  const qHidden = `name='${HIDDEN_FILENAME}' and trashed=false`;
  const qVisible = `name='${VISIBLE_FILENAME}' and trashed=false`;

  const [hRes, vRes] = await Promise.all([
    fetch(`${DRIVE_API}/files?q=${encodeURIComponent(qHidden)}&fields=files(id)&spaces=appDataFolder`,
      { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${DRIVE_API}/files?q=${encodeURIComponent(qVisible)}&fields=files(id)&spaces=drive`,
      { headers: { Authorization: `Bearer ${token}` } })
  ]);

  const [hData, vData] = await Promise.all([
    hRes.ok ? hRes.json() : Promise.resolve({ files: [] }),
    vRes.ok ? vRes.json() : Promise.resolve({ files: [] }),
  ]);

  return {
    hiddenId: hData.files?.[0]?.id || null,
    visibleId: vData.files?.[0]?.id || null,
  };
}

/**
 * 單一檔案讀取原語
 */
export async function readDriveFile(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB; etag: string }> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Read Failed: ${res.status}`);

  let etag = res.headers.get("ETag")?.replace(/"/g, "").replace(/^W\//, "") || "";
  if (!etag) {
    const meta = await (await fetch(`${DRIVE_API}/files/${fileId}?fields=etag`, {
      headers: { Authorization: `Bearer ${token}` }
    })).json();
    etag = meta.etag?.replace(/"/g, "") || "";
  }

  const ciphertext = await res.text();
  if (ciphertext.trimStart().startsWith("{")) {
    return { db: JSON.parse(ciphertext) as DriveDB, etag };
  }
  return { db: await decryptDB(ciphertext, uid), etag };
}

/**
 * 加密並寫入單個檔案 (支援 ETag)
 */
export async function writeDriveFile(
  token: string,
  fileId: string,
  db: DriveDB,
  uid: string,
  etag?: string
): Promise<string> {
  const encrypted = await encryptDB({ ...db, lastModified: Date.now() }, uid);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "text/plain",
  };
  if (etag) headers["If-Match"] = etag;

  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media&fields=etag`, {
    method: "PATCH",
    headers,
    body: encrypted,
  });
  if (res.status === 412) throw new Error("SYNC_CONFLICT");
  if (!res.ok) throw new Error(`Write failed: ${res.status}`);
  const data = await res.json();
  return data.etag?.replace(/"/g, "") || "";
}

/**
 * 建立新檔案
 */
export async function createDriveFile(
  token: string,
  uid: string,
  db: DriveDB,
  space: "appDataFolder" | "drive",
  filename: string
): Promise<string> {
  const encrypted = await encryptDB(db, uid);
  const metadata = { name: filename, mimeType: "text/plain", parents: [space === "drive" ? "root" : space] };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([encrypted], { type: "text/plain" }));

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

/**
 * 啟動時的韌性雙端讀取
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
  const [hRes, vRes] = await Promise.all([
    ids.hiddenId ? readDriveFile(token, ids.hiddenId, uid).catch(() => null) : Promise.resolve(null),
    ids.visibleId ? readDriveFile(token, ids.visibleId, uid).catch(() => null) : Promise.resolve(null)
  ]);

  const hDB = hRes?.db;
  const vDB = vRes?.db;
  let finalDB = (hDB && vDB) ? (hDB.lastModified >= vDB.lastModified ? hDB : vDB) : (hDB || vDB || null);
  
  return {
    db: finalDB || emptyDB(),
    hiddenEtag: hRes?.etag || "",
    visibleEtag: vRes?.etag || "",
    needsRepair: !hRes || !vRes
  };
}

/**
 * 垃圾桶大掃除
 */
export function cleanupTrash(db: DriveDB) {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const originalCount = db.cards.length;
  db.cards = db.cards.filter((card) => !card.deletedAt || card.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== originalCount };
}
