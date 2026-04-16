/**
 * 用戶端 AES-256-GCM 加密工具 (v2.23.0 Email 核心版)
 * ─────────────────────────────────────────────
 * 變更：
 * 統一使用使用者 Google Email 作為金鑰種子，捨棄不穩定的動態 UID。
 * 達成「Google 帳號相同 = 金鑰相同」的極簡化同步目標。
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
export async function getKeyHash(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(seed));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

/**
 * 從種子 (Email) 衍生 AES-GCM CryptoKey
 */
async function deriveKey(seed: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(seed),
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

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.byteLength; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * 加密 DriveDB
 */
export async function encryptDB(db: DriveDB, keySeed: string): Promise<string> {
  const key = await deriveKey(keySeed);
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
 * 解密 DriveDB
 */
export async function decryptDB(ciphertext: string, keySeed: string): Promise<DriveDB> {
  const [ivB64, cipherB64] = ciphertext.split(".");
  if (!ivB64 || !cipherB64) {
    throw new Error("格式錯誤");
  }

  const key = await deriveKey(keySeed);
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
 * 本地加密
 */
export async function encryptText(text: string, keySeed: string): Promise<string> {
  const key = await deriveKey(keySeed);
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
 * 本地解密
 */
export async function decryptText(encrypted: string, keySeed: string): Promise<string> {
  const [ivB64, cipherB64] = encrypted.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Format invalid");

  const key = await deriveKey(keySeed);
  const iv = base64ToUint8(ivB64);
  const cipherBuf = base64ToUint8(cipherB64);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuf
  );

  return new TextDecoder().decode(plainBuf);
}
