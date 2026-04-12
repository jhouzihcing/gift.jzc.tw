"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type ScanState = "idle" | "scanning-a" | "scanning-b" | "success" | "error" | "duplicate" | "loading" | "cooldown";

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
  const quaggaLibRef = useRef<any>(null);

  const triggerVibrate = (pattern: number | number[]) => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const getQuagga = useCallback(async () => {
    if (quaggaLibRef.current) return quaggaLibRef.current;
    if (typeof window === "undefined") return null;
    try {
      const M = await import("@ericblade/quagga2");
      quaggaLibRef.current = M.default;
      return M.default;
    } catch (e) {
      return null;
    }
  }, []);

  const stopScanning = useCallback(async () => {
    isProcessing.current = false;
    const Quagga = await getQuagga();
    if (!Quagga) return;
    try {
      await Quagga.stop();
      Quagga.offDetected();
      const container = document.getElementById(elementId);
      if (container) container.innerHTML = ""; 
    } catch (err) {}
    if (isMounted.current) setScanState("idle");
  }, [elementId, getQuagga]);

  const resetData = useCallback(() => {
    dataRef.current = { primary: null, secondary: null };
    setData({ primary: null, secondary: null });
    setScanState("scanning-a");
    isProcessing.current = false;
  }, []);

  // v1.11.0: 自動冷卻器，實現無感連續掃描
  const startCooldown = useCallback(() => {
    setScanState("cooldown");
    setTimeout(() => {
      if (isMounted.current) {
        resetData();
      }
    }, 2500); // 2.5 秒冷卻時間，讓使用者看到結果
  }, [resetData]);

  const handleDetected = useCallback((result: any) => {
    if (isProcessing.current || !isMounted.current || scanState === "cooldown" || scanState === "success") return;
    
    // 支援單一或多重結果
    const results = Array.isArray(result) ? result : [result];
    if (results.length === 0) return;

    const currentData = dataRef.current;
    let foundPrimary: string | null = null;
    let foundSecondary: string | null = null;

    // 遍歷當前影框中的所有條碼
    for (const r of results) {
      if (r.codeResult.confidence < 0.6) continue;
      const text = r.codeResult.code;

      // 16 碼純數字視為卡號
      if (text.length === 16 && /^\d+$/.test(text)) {
        foundPrimary = text;
      } else {
        foundSecondary = text;
      }
    }

    // [v1.10.0 核心邏輯]：瞬發雙掃描
    if (isDualMode && foundPrimary && foundSecondary && foundPrimary !== foundSecondary) {
      isProcessing.current = true;
      triggerVibrate([60, 100, 60]); // 雙重碎震代表一次到位
      dataRef.current = { primary: foundPrimary, secondary: foundSecondary };
      setData({ primary: foundPrimary, secondary: foundSecondary });
      setScanState("success");
      startCooldown(); 
      return;
    }

    // 否則，走標準流程
    const firstMatch = results.find(r => r.codeResult.confidence >= 0.7);
    if (!firstMatch) return;
    const text = firstMatch.codeResult.code;

    if (!currentData.primary) {
      // 只有在是 16 碼數字或者是卡號格式時才接受為 Primary
      if (text.length === 16 && /^\d+$/.test(text)) {
        isProcessing.current = true;
        triggerVibrate(60); 
        currentData.primary = text;
        setData({ ...currentData });

        if (!isDualMode) {
          setScanState("success");
          startCooldown();
        } else {
          setScanState("scanning-b");
          setTimeout(() => { if (isMounted.current) isProcessing.current = false; }, 1500);
        }
      }
    } else if (isDualMode && !currentData.secondary && text !== currentData.primary) {
       isProcessing.current = true;
       triggerVibrate([100, 50, 100]);
       currentData.secondary = text;
       setData({ ...currentData });
       setScanState("success");
       startCooldown();
    }
  }, [isDualMode, scanState, startCooldown]);

  const startScanning = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    
    setTimeout(async () => {
      try {
        if (!isMounted.current) return;
        await stopScanning();
        const Quagga = await getQuagga();
        if (!Quagga) return;

        setErrorMsg(null);
        setScanState("loading");
        isProcessing.current = false;
        dataRef.current = { primary: null, secondary: null };
        setData({ primary: null, secondary: null });

        // v1.10.0: 開啟 Multiple 模式與 360x200 寬視野
        await Quagga.init({
          inputStream: {
            name: "LiveStream",
            type: "LiveStream",
            target: `#${elementId}`,
            constraints: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "environment"
            }
          },
          locator: {
             patchSize: "large",
             halfSample: true,
          },
          numOfWorkers: 2, 
          decoder: {
            readers: ["code_128_reader"],
            multiple: true // <--- 重要：開啟多重辨識
          },
          locate: true 
        });

        if (isMounted.current) {
          Quagga.start();
          Quagga.onDetected(handleDetected);
          setScanState("scanning-a");
        }
      } catch (err: any) {
        if (isMounted.current) {
          setErrorMsg("相機啟動異常");
          setScanState("error");
        }
      } finally {
        isInitializing.current = false;
      }
    }, 400); 
  }, [elementId, stopScanning, handleDetected, getQuagga]);

  // 跳過第二段卡號
  const skipSecondary = useCallback(() => {
    if (dataRef.current.primary) {
      isProcessing.current = true;
      setScanState("success");
      startCooldown();
    }
  }, [startCooldown]);

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
