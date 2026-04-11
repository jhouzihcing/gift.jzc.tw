"use client";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useState, useCallback, useRef, useEffect } from "react";

export type ScanState = "idle" | "scanning-a" | "scanning-b" | "success" | "error" | "duplicate";

interface BarcodeData {
  primary: string | null;
  secondary: string | null;
}

export function useScanner(elementId: string) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [data, setData] = useState<BarcodeData>({ primary: null, secondary: null });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDualMode, setIsDualMode] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dataRef = useRef<BarcodeData>({ primary: null, secondary: null });

  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        // Quietly fail stop
      }
      scannerRef.current = null;
    }
    setScanState("idle");
  }, []);

  const startScanning = useCallback(async () => {
    // 延遲啟動以確保 Next.js DOM 已完全掛載
    setTimeout(async () => {
      try {
        if (scannerRef.current) {
          await stopScanning();
        }

        setErrorMsg(null);
        setScanState("scanning-a");
        dataRef.current = { primary: null, secondary: null };
        setData({ primary: null, secondary: null });

        const html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { 
            facingMode: "environment",
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 }
          }, 
          {
            fps: 30, // 追求極速反應
            // 重點：不提供 qrbox 參數，讓掃描引擎進行全螢幕辨識 (增加容錯率)
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_93,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ]
          },
          (decodedText) => {
            const currentData = dataRef.current;
            
            if (!currentData.primary) {
              triggerVibrate(60); 
              currentData.primary = decodedText;
              setData({ ...currentData });

              if (!isDualMode) {
                setScanState("success");
                stopScanning();
              } else {
                setScanState("scanning-b");
                html5Qrcode.pause();
                setTimeout(() => {
                  if (scannerRef.current && scannerRef.current.isScanning) {
                    scannerRef.current.resume();
                  }
                }, 1000);
              }
            } else if (isDualMode && !currentData.secondary) {
              if (decodedText === currentData.primary) {
                setScanState("duplicate");
                triggerVibrate([50, 50, 50]);
                setTimeout(() => {
                  if (dataRef.current.secondary) return;
                  setScanState("scanning-b");
                }, 1500);
              } else {
                triggerVibrate([100, 50, 100]);
                currentData.secondary = decodedText;
                setData({ ...currentData });
                setScanState("success");
                stopScanning();
              }
            }
          },
          () => {} // Quietly ignore frame failures
        );
      } catch (err: any) {
        console.error("Scanner start failed:", err);
        setErrorMsg(err?.message || "相機啟動失敗，請確認是否授予權限或環境光線是否過暗");
        setScanState("error");
      }
    }, 350); // 350ms 穩定 DOM
  }, [elementId, stopScanning, isDualMode]);

  const skipSecondary = useCallback(() => {
    if (dataRef.current.primary) {
      setScanState("success");
      stopScanning();
    }
  }, [stopScanning]);

  useEffect(() => {
    return () => { stopScanning(); };
  }, [stopScanning]);

  return {
    scanState,
    data,
    errorMsg,
    isDualMode,
    setIsDualMode,
    startScanning,
    stopScanning,
    skipSecondary
  };
}

