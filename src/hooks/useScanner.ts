"use client";

import Quagga from "@ericblade/quagga2";
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
  
  const dataRef = useRef<BarcodeData>({ primary: null, secondary: null });
  const isInitializing = useRef(false);
  const isMounted = useRef(true);
  const isProcessing = useRef(false);

  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const stopScanning = useCallback(async () => {
    isProcessing.current = false;
    try {
      await Quagga.stop();
      Quagga.offDetected();
      const container = document.getElementById(elementId);
      if (container) container.innerHTML = ""; 
    } catch (err) {
      // Ignore
    }
    if (isMounted.current) setScanState("idle");
  }, [elementId]);

  const resetData = useCallback(() => {
    dataRef.current = { primary: null, secondary: null };
    setData({ primary: null, secondary: null });
    setScanState("scanning-a");
    isProcessing.current = false;
  }, []);

  const handleDetected = useCallback((result: any) => {
    if (isProcessing.current || !isMounted.current) return;
    
    // Quagga 回報成功率權重 (過濾低信心度的掃描，避免誤讀)
    if (result.codeResult.confidence < 0.6) return;

    const decodedText = result.codeResult.code;
    const currentData = dataRef.current;
    
    // 處理第一段條碼 (卡號)
    if (!currentData.primary) {
      // 邏輯保持一致：如果是 16 位或非純數字，視為卡號
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
           setTimeout(() => { if (isMounted.current) isProcessing.current = false; }, 1500);
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
        triggerVibrate([100, 50, 100]);
        currentData.secondary = decodedText;
        setData({ ...currentData });
        isProcessing.current = true;
        setScanState("success");
      }
    }
  }, [isDualMode]);

  const startScanning = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    
    // 給予 DOM 一點緩衝時間
    setTimeout(async () => {
      try {
        if (!isMounted.current) return;
        await stopScanning();

        setErrorMsg(null);
        setScanState("scanning-a");
        isProcessing.current = false;
        dataRef.current = { primary: null, secondary: null };
        setData({ primary: null, secondary: null });

        // v1.9.0 導入 Quagga2 技術：橫向極速解碼
        Quagga.init({
          inputStream: {
            name: "LiveStream",
            type: "LiveStream",
            target: `#${elementId}`,
            constraints: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "environment",
              aspectRatio: { min: 1, max: 2 },
            },
            singleChannel: false // 針對彩色影像優化
          },
          locator: {
             patchSize: "large", // v1.9.0 核心：大補丁定位，提高 Code 128 首發命中率
             halfSample: true, // 降低處理負擔，提升幀率
          },
          numOfWorkers: 4, // 移動端多核心加速
          decoder: {
            readers: ["code_128_reader"], // 只保留對 Code 128 的支援，排除干擾
            multiple: false
          },
          locate: true // 開啟條碼定位機制，增加精準度
        }, (err) => {
          if (err) {
            console.error("Quagga2 Init Error:", err);
            if (isMounted.current) {
              setErrorMsg("相機啟動失敗");
              setScanState("error");
            }
            return;
          }
          if (isMounted.current) {
            Quagga.start();
            Quagga.onDetected(handleDetected);
          }
        });

      } catch (err: any) {
        console.error("Quagga2 startup failed:", err);
        if (isMounted.current) {
          setErrorMsg("相機連結失敗");
          setScanState("error");
        }
      } finally {
        isInitializing.current = false;
      }
    }, 500); 
  }, [elementId, stopScanning, handleDetected]);

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
