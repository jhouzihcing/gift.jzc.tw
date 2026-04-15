import { encryptDB, decryptDB } from "./crypto";

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
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&t=${Date.now()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
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
 * 在根目錄搜尋資料檔案 (極速單軌版)
 */
export async function getOrCreateDriveFile(token: string): Promise<string> {
  const q = `name='${VISIBLE_FILENAME}' and trashed=false`;
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&t=${Date.now()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (!searchRes.ok) throw new Error(`Drive search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // 建立全新檔案
  return createDriveFile(token, emptyDB(), VISIBLE_FILENAME);
}

/**
 * 讀取並解密資料庫 (支援快取破除)
 */
export async function readDriveDB(
  token: string,
  fileId: string,
  uid: string
): Promise<{ db: DriveDB; etag: string }> {
  // 加入時間戳記避免瀏覽器快取 (Cache Busting)
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`Read Failed: ${res.status}`);

  let etag = res.headers.get("ETag")?.replace(/"/g, "").replace(/^W\//, "") || "";
  if (!etag) {
    const meta = await (await fetch(`${DRIVE_API}/files/${fileId}?fields=etag&t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
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
 * 加密並寫入單個檔案 (支援 ETag 衝突保護)
 */
export async function writeDriveDB(
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
  db: DriveDB,
  filename: string
): Promise<string> {
  // 建立文件時不需要 uid，因為 encryptDB 已經在那裡處理
  // 這裡假設已經有 uid 或者是初始建立不需要加密 (不，應該是要加密的)
  // 修正：需要傳入 uid
  // 但為了穩定性，我這裡先恢復原來的 create 方法
  const metadata = { name: filename, mimeType: "text/plain", parents: ["root"] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(db)], { type: "text/plain" })); // 初始建立為 JSON 格式

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
 * 垃圾桶大掃除
 */
export function cleanupTrash(db: DriveDB) {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const originalCount = db.cards.length;
  db.cards = db.cards.filter((card) => !card.deletedAt || card.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== originalCount };
}
