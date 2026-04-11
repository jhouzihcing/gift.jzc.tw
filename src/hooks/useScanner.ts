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
  const isInitializing = useRef(false);
  const isMounted = useRef(true);

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
        const container = document.getElementById(elementId);
        if (container) container.innerHTML = ""; 
      } catch (err) {
        // Quietly fail
      }
      scannerRef.current = null;
    }
    if (isMounted.current) setScanState("idle");
  }, [elementId]);

  // 重置掃描狀態而不關閉相機 (關鍵修復：用於連續掃描模式)
  const resetScanner = useCallback(() => {
    dataRef.current = { primary: null, secondary: null };
    setData({ primary: null, secondary: null });
    setScanState("scanning-a");
    if (scannerRef.current && scannerRef.current.isPaused()) {
      scannerRef.current.resume();
    }
  }, []);

  const startScanning = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    
    setTimeout(async () => {
      try {
        if (!isMounted.current) return;
        if (scannerRef.current) await stopScanning();

        setErrorMsg(null);
        setScanState("scanning-a");
        dataRef.current = { primary: null, secondary: null };
        setData({ primary: null, secondary: null });

        const html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" }, 
          {
            fps: 18,
            aspectRatio: 1.77777778,
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
            if (scanState === "success") return; // 防止重複觸發

            if (!currentData.primary) {
              triggerVibrate(60); 
              currentData.primary = decodedText;
              setData({ ...currentData });

              if (!isDualMode) {
                setScanState("success");
                // 這裡移除自動 stopScanning，交給 UI 決定
                if (scannerRef.current) scannerRef.current.pause();
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
                  if (isMounted.current) setScanState("scanning-b");
                }, 1500);
              } else {
                triggerVibrate([100, 50, 100]);
                currentData.secondary = decodedText;
                setData({ ...currentData });
                setScanState("success");
                if (scannerRef.current) scannerRef.current.pause();
              }
            }
          },
          () => {} 
        );
      } catch (err: any) {
        console.error("Camera error:", err);
        if (isMounted.current) {
          setErrorMsg(err?.message || "無法啟動相機。");
          setScanState("error");
        }
      } finally {
        isInitializing.current = false;
      }
    }, 450); 
  }, [elementId, stopScanning, isDualMode, scanState]);

  const skipSecondary = useCallback(() => {
    if (dataRef.current.primary) {
      setScanState("success");
      if (scannerRef.current) scannerRef.current.pause();
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => { 
      isMounted.current = false;
      stopScanning(); 
    };
  }, [stopScanning]);

  return {
    scanState,
    data,
    errorMsg,
    isDualMode,
    setIsDualMode,
    startScanning,
    stopScanning,
    resetScanner,
    skipSecondary
  };
}



