/**
 * 用戶端 AES-256-GCM 加密工具 (v2.20.0 強韌版)
 * ─────────────────────────────────────────────
 * 優化：
 * 1. 增加 getKeyHash 用於跨裝置手動校驗金鑰一致性。
 * 2. 強化 Base64 轉換，避免在大數據下發生堆疊溢位或編碼偏移。
 */

import type { DriveDB } from "./driveFile";

const SALT_HEX = "5367636d2d76312d73616c74"; // "sgcm-v1-salt"
const ITERATIONS = 100_000;

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, 2 + i), 16);
  }
  return bytes;
}

/**
 * 取得當前金鑰的校驗碼 (Hash)
 */
export async function getKeyHash(uid: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(uid));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

/**
 * 從使用者 UID 衍生 AES-GCM CryptoKey
 */
async function deriveKey(uid: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(uid),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: hexToUint8(SALT_HEX),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * 穩定版 Uint8Array 轉 Base64
 */
function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.byteLength; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/**
 * 穩定版 Base64 轉 Uint8Array
 */
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * 將 DriveDB 加密成 Base64 字串後上傳至 Drive
 */
export async function encryptDB(db: DriveDB, uid: string): Promise<string> {
  const key = await deriveKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(db));

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  const ivB64 = uint8ToBase64(iv);
  const cipherB64 = uint8ToBase64(new Uint8Array(cipherBuf));

  return `${ivB64}.${cipherB64}`;
}

/**
 * 將從 Drive 讀回的密文解密成 DriveDB
 */
export async function decryptDB(ciphertext: string, uid: string): Promise<DriveDB> {
  const [ivB64, cipherB64] = ciphertext.split(".");
  if (!ivB64 || !cipherB64) {
    throw new Error("格式錯誤：密文結構不完整");
  }

  const key = await deriveKey(uid);
  const iv = base64ToUint8(ivB64);
  const cipherBuf = base64ToUint8(cipherB64);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuf
  );

  return JSON.parse(new TextDecoder().decode(plainBuf)) as DriveDB;
}

/**
 * 本地 Storage 加密
 */
export async function encryptText(text: string, uid: string): Promise<string> {
  const key = await deriveKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(text);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return `${uint8ToBase64(iv)}.${uint8ToBase64(new Uint8Array(cipherBuf))}`;
}

/**
 * 本地 Storage 解密
 */
export async function decryptText(encrypted: string, uid: string): Promise<string> {
  const [ivB64, cipherB64] = encrypted.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Format invalid");

  const key = await deriveKey(uid);
  const iv = base64ToUint8(ivB64);
  const cipherBuf = base64ToUint8(cipherB64);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuf
  );

  return new TextDecoder().decode(plainBuf);
}
