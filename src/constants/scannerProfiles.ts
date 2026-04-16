/**
 * ZJ Card 掃描器特徵檔 (Scanner Profiles)
 * 用於定義不同商家的條碼格式與識別邏輯
 */

export interface ScannerProfile {
  id: string;
  name: string;
  readers: string[];
  isDualModeDefault: boolean;
  // 卡號判定規則
  primaryValidator: (text: string) => boolean;
  // 密碼判定規則
  secondaryValidator: (text: string, primary: string) => boolean;
  vibrationPattern: number | number[];
}

export const SCANNER_PROFILES: Record<string, ScannerProfile> = {
  "7-11": {
    id: "7-11",
    name: "7-11 商品卡",
    readers: ["code_128_reader"],
    isDualModeDefault: true,
    // 7-11 卡號固定為 16 位純數字
    primaryValidator: (text) => text.length === 16 && /^\d+$/.test(text),
    // 密碼只要不是卡號本人即可 (通常也是純數字或包含英文)
    secondaryValidator: (text, primary) => text !== primary && text.length >= 4,
    vibrationPattern: [60, 100, 60],
  },
  "Generic": {
    id: "Generic",
    name: "通用模式",
    readers: ["code_128_reader", "ean_reader", "upc_reader"],
    isDualModeDefault: false,
    // 通用模式：長度大於 5 即視為有效條碼
    primaryValidator: (text) => text.length >= 5,
    secondaryValidator: (text, primary) => text !== primary && text.length >= 4,
    vibrationPattern: 60,
  }
};
