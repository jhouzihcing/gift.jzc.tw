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

  // ✅ 核心修復：用 Ref 鏡像 state，讓 handleDetected 讀取最新值而不產生依賴
  const scanStateRef = useRef<ScanState>("idle");
  const isDualModeRef = useRef(false);

  // 同步 ref 與 state
  const setScanStateSync = useCallback((s: ScanState) => {
    scanStateRef.current = s;
    setScanState(s);
  }, []);

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
    const Quagga = quaggaLibRef.current;
    if (!Quagga) return;
    try {
      Quagga.offDetected();
      await Quagga.stop();
      const container = document.getElementById(elementId);
      if (container) container.innerHTML = "";
    } catch (err) {}
    if (isMounted.current) setScanStateSync("idle");
  }, [elementId, setScanStateSync]);

  const resetData = useCallback(() => {
    dataRef.current = { primary: null, secondary: null };
    setData({ primary: null, secondary: null });
    setScanStateSync("scanning-a");
    isProcessing.current = false;
  }, [setScanStateSync]);

  const startCooldown = useCallback(() => {
    setScanStateSync("cooldown");
    setTimeout(() => {
      if (isMounted.current) {
        resetData();
      }
    }, 2500);
  }, [setScanStateSync, resetData]);

  // ✅ 不再依賴任何 state，完全透過 ref 讀取最新狀態
  const handleDetected = useCallback((result: any) => {
    // 透過 ref 讀取最新值，避免 stale closure
    const currentScanState = scanStateRef.current;
    const currentIsDualMode = isDualModeRef.current;

    if (isProcessing.current || !isMounted.current) return;
    if (currentScanState === "cooldown" || currentScanState === "success") return;

    const results = Array.isArray(result) ? result : [result];
    if (results.length === 0) return;

    const currentData = dataRef.current;
    let foundPrimary: string | null = null;
    let foundSecondary: string | null = null;

    for (const r of results) {
      if (r.codeResult.confidence < 0.6) continue;
      const text = r.codeResult.code;
      if (text.length === 16 && /^\d+$/.test(text)) {
        foundPrimary = text;
      } else {
        foundSecondary = text;
      }
    }

    // 瞬發雙掃描：同時捕捉卡號與密碼
    if (currentIsDualMode && foundPrimary && foundSecondary && foundPrimary !== foundSecondary) {
      isProcessing.current = true;
      triggerVibrate([60, 100, 60]);
      dataRef.current = { primary: foundPrimary, secondary: foundSecondary };
      setData({ primary: foundPrimary, secondary: foundSecondary });
      setScanStateSync("success");
      startCooldown();
      return;
    }

    const firstMatch = results.find(r => r.codeResult.confidence >= 0.7);
    if (!firstMatch) return;
    const text = firstMatch.codeResult.code;

    if (!currentData.primary) {
      if (text.length === 16 && /^\d+$/.test(text)) {
        isProcessing.current = true;
        triggerVibrate(60);
        currentData.primary = text;
        setData({ ...currentData });

        if (!currentIsDualMode) {
          setScanStateSync("success");
          startCooldown();
        } else {
          setScanStateSync("scanning-b");
          setTimeout(() => { if (isMounted.current) isProcessing.current = false; }, 1500);
        }
      }
    } else if (currentIsDualMode && !currentData.secondary && text !== currentData.primary) {
      isProcessing.current = true;
      triggerVibrate([100, 50, 100]);
      currentData.secondary = text;
      setData({ ...currentData });
      setScanStateSync("success");
      startCooldown();
    }
  // ✅ 依賴陣列不含任何 state，只有穩定的函數引用
  }, [setScanStateSync, startCooldown]);

  const startScanning = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;

    // 先停止可能仍在運行的實例
    const ExistingQuagga = quaggaLibRef.current;
    if (ExistingQuagga) {
      try {
        ExistingQuagga.offDetected();
        await ExistingQuagga.stop();
        const container = document.getElementById(elementId);
        if (container) container.innerHTML = "";
      } catch (_) {}
    }

    setScanStateSync("loading");
    isProcessing.current = false;
    dataRef.current = { primary: null, secondary: null };
    setData({ primary: null, secondary: null });
    setErrorMsg(null);

    // 給 DOM 渲染時間
    await new Promise(r => setTimeout(r, 300));

    try {
      if (!isMounted.current) return;

      const Quagga = await getQuagga();
      if (!Quagga) throw new Error("Quagga unavailable");

      await Quagga.init({
        inputStream: {
          name: "LiveStream",
          type: "LiveStream",
          target: `#${elementId}`,
          constraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "environment",
          },
        },
        locator: {
          patchSize: "large",
          halfSample: true,
        },
        numOfWorkers: 2,
        decoder: {
          readers: ["code_128_reader"],
          multiple: true,
        },
        locate: true,
      });

      if (isMounted.current) {
        Quagga.start();
        Quagga.onDetected(handleDetected);
        setScanStateSync("scanning-a");
      }
    } catch (err: any) {
      console.error("Scanner init failed:", err);
      if (isMounted.current) {
        setErrorMsg("相機啟動異常，請確認已授權相機權限");
        setScanStateSync("error");
      }
    } finally {
      isInitializing.current = false;
    }
  // ✅ handleDetected 現在是穩定的，startScanning 不再被 scanState 變化觸發重建
  }, [elementId, handleDetected, getQuagga, setScanStateSync]);

  const skipSecondary = useCallback(() => {
    if (dataRef.current.primary) {
      isProcessing.current = true;
      setScanStateSync("success");
      startCooldown();
    }
  }, [setScanStateSync, startCooldown]);

  // 同步 isDualMode state -> ref
  useEffect(() => {
    isDualModeRef.current = isDualMode;
  }, [isDualMode]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // 清理 Quagga
      const Q = quaggaLibRef.current;
      if (Q) {
        try { Q.offDetected(); Q.stop(); } catch (_) {}
      }
    };
  }, []);

  return {
    scanState,
    data,
    errorMsg,
    isDualMode,
    setIsDualMode,
    startScanning,
    stopScanning,
    resetData,
    skipSecondary,
  };
}
