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
      await fetch(`${DRIVE_API}/files/${oldFileId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: VISIBLE_FILENAME }),
      });
    }
  } catch {
    // 遷移失敗不影響主流程
  }
}

/**
 * 在根目錄搜尋或建立資料檔案
 */
export async function getOrCreateDriveFile(token: string, uid: string): Promise<string> {
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

  // 建立全新加密檔案
  const encrypted = await encryptDB(emptyDB(), uid);
  const metadata = { name: VISIBLE_FILENAME, mimeType: "text/plain", parents: ["root"] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([encrypted], { type: "text/plain" }));

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
  const created = await createRes.json();
  return created.id;
}

/**
 * 從 Drive 讀取並解密資料庫
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
    // 舊版明文 JSON，向下相容
    return { db: JSON.parse(ciphertext) as DriveDB };
  }
  return { db: await decryptDB(ciphertext, uid) };
}

/**
 * 加密並寫入資料庫至 Drive（無 etag，永遠以讀後最新狀態覆寫）
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
    const detail = await res.text().catch(() => "");
    throw new Error(`Write failed: ${res.status} ${detail}`.trim());
  }
}

/**
 * 垃圾桶大掃除：移除 15 天以上的軟刪除卡片
 */
export function cleanupTrash(db: DriveDB): { db: DriveDB; changed: boolean } {
  const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
  const before = db.cards.length;
  db.cards = db.cards.filter((c) => !c.deletedAt || c.deletedAt >= fifteenDaysAgo);
  return { db, changed: db.cards.length !== before };
}
