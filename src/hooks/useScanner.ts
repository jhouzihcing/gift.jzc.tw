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
  const isProcessing = useRef(false); // 核心：代碼級別的鎖，取代硬體暫停

  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const stopScanning = useCallback(async () => {
    isProcessing.current = false;
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        const container = document.getElementById(elementId);
        if (container) container.innerHTML = ""; 
      } catch (err) {
        // Quiet fail
      }
      scannerRef.current = null;
    }
    if (isMounted.current) setScanState("idle");
  }, [elementId]);

  const resetData = useCallback(() => {
    dataRef.current = { primary: null, secondary: null };
    setData({ primary: null, secondary: null });
    setScanState("scanning-a");
    isProcessing.current = false;
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
        isProcessing.current = false;
        dataRef.current = { primary: null, secondary: null };
        setData({ primary: null, secondary: null });

        const html5Qrcode = new Html5Qrcode(elementId, {
          formatsToSupport: [ Html5QrcodeSupportedFormats.CODE_128 ],
          verbose: false
        });
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" }, 
          {
            fps: 40,
            qrbox: { width: 320, height: 160 },
            aspectRatio: 1.77777778,
            disableFlip: true, // 一維條碼不需要鏡像翻轉，節省 CPU
          },
          (decodedText) => {
            if (isProcessing.current || !isMounted.current) return;

            const currentData = dataRef.current;
            
            // 處理第一段條碼 (卡號)
            if (!currentData.primary) {
              // 7-11 預設規則：16 位
              if (decodedText.length === 16 || !decodedText.match(/^\d+$/)) {
                 triggerVibrate(60); 
                 currentData.primary = decodedText;
                 setData({ ...currentData });

                 if (!isDualMode) {
                   isProcessing.current = true;
                   setScanState("success");
                 } else {
                   setScanState("scanning-b");
                   isProcessing.current = true;
                   setTimeout(() => { if (isMounted.current) isProcessing.current = false; }, 1200);
                 }
              }
            } 
            // 處理第二段條碼 (密碼/序號)
            else if (isDualMode && !currentData.secondary) {
              if (decodedText === currentData.primary) {
                isProcessing.current = true;
                setScanState("duplicate");
                triggerVibrate([50, 50, 50]);
                setTimeout(() => {
                  if (dataRef.current.secondary) return;
                  if (isMounted.current) {
                    setScanState("scanning-b");
                    isProcessing.current = false;
                  }
                }, 1800);
              } else {
                // 7-11 密碼通常是 10 位，或者非卡號的另一條
                triggerVibrate([100, 50, 100]);
                currentData.secondary = decodedText;
                setData({ ...currentData });
                isProcessing.current = true;
                setScanState("success");
              }
            }
          },
          () => {} 
        );
      } catch (err: any) {
        console.error("Camera startup failed:", err);
        if (isMounted.current) {
          setErrorMsg("相機啟動失敗");
          setScanState("error");
        }
      } finally {
        isInitializing.current = false;
      }
    }, 400); 
  }, [elementId, stopScanning, isDualMode]);


  const skipSecondary = useCallback(() => {
    if (dataRef.current.primary) {
      isProcessing.current = true;
      setScanState("success");
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
    resetData,
    skipSecondary
  };
}




