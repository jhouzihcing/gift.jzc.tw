"use client";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useState, useCallback, useRef, useEffect } from "react";

export type ScanState = "idle" | "scanning-a" | "scanning-b" | "success" | "error";

interface BarcodeData {
  primary: string | null;
  secondary: string | null;
}

export function useScanner(elementId: string) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [data, setData] = useState<BarcodeData>({ primary: null, secondary: null });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dataRef = useRef<BarcodeData>({ primary: null, secondary: null });

  // 震動回饋輔助函式
  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("終止掃描失敗", err);
      }
    }
    setScanState("idle");
  }, []);

  const startScanning = useCallback(async () => {
    try {
      setErrorMsg(null);
      setScanState("scanning-a");
      dataRef.current = { primary: null, secondary: null };
      setData({ primary: null, secondary: null });

      const html5Qrcode = new Html5Qrcode(elementId);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" }, 
        {
          fps: 15, // 拉高幀數加強速度
          qrbox: { width: 300, height: 100 }, // 加寬橫向適合一維條碼
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.ITF,
          ]
        },
        (decodedText) => {
          // 這裡會每秒 10 次連續觸發，因此我們得用 dataRef 跟 state 做判斷
          const currentData = dataRef.current;
          
          if (!currentData.primary) {
            // 掃到第一個條碼 (A)
            triggerVibrate(50); // 短震動
            currentData.primary = decodedText;
            setData({ ...currentData });
            setScanState("scanning-b");
            
            // 暫停一秒，讓用戶有時間把鏡頭移到第二條碼，避免誤掃
            html5Qrcode.pause();
            setTimeout(() => {
                if (scannerRef.current && scannerRef.current.isScanning) {
                  scannerRef.current.resume();
                }
            }, 1000);
          } else if (!currentData.secondary && decodedText !== currentData.primary) {
            // 掃到第二個條碼 (B)，且不可與第一個重複
            triggerVibrate([100, 50, 100]); // 成功雙震動 (噔-噔)
            currentData.secondary = decodedText;
            setData({ ...currentData });
            setScanState("success");
            stopScanning(); // 雙管齊下，結束相機
          }
        },
        () => {
          // 掃描過程中畫面如果沒有條碼會頻繁觸發此回呼，我們選擇安靜忽略
        }
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "相機啟動異常或被拒絕授權");
      setScanState("error");
    }
  }, [elementId, stopScanning]);

  const skipSecondary = useCallback(() => {
    // 讓只有單條碼卡片的人可以直接提早結束
    if (dataRef.current.primary) {
      setScanState("success");
      stopScanning();
    }
  }, [stopScanning]);

  // 組件被卸載 (例如跳轉到其他頁面) 時，一定要掛斷相機，否則瀏覽器會一直亮綠燈
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    scanState,
    data,
    errorMsg,
    startScanning,
    stopScanning,
    skipSecondary
  };
}
