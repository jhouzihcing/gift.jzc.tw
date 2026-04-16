"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ScannerProfile } from "@/constants/scannerProfiles";

export type ScanState = "idle" | "scanning-a" | "scanning-b" | "success" | "error" | "duplicate" | "loading" | "cooldown";

interface BarcodeData {
  primary: string | null;
  secondary: string | null;
}

export function useScanner(elementId: string, profile: ScannerProfile) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [data, setData] = useState<BarcodeData>({ primary: null, secondary: null });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDualMode, setIsDualMode] = useState(profile.isDualModeDefault);
  
  const dataRef = useRef<BarcodeData>({ primary: null, secondary: null });
  const isInitializing = useRef(false);
  const isMounted = useRef(true);
  const isProcessing = useRef(false);
  const quaggaLibRef = useRef<any>(null);

  const scanStateRef = useRef<ScanState>("idle");
  const isDualModeRef = useRef(profile.isDualModeDefault);
  const profileRef = useRef<ScannerProfile>(profile);

  // 同步 ref
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

  const handleDetected = useCallback((result: any) => {
    const currentScanState = scanStateRef.current;
    const currentIsDualMode = isDualModeRef.current;
    const currentProfile = profileRef.current;

    if (isProcessing.current || !isMounted.current) return;
    if (currentScanState === "cooldown" || currentScanState === "success") return;

    const results = Array.isArray(result) ? result : [result];
    if (results.length === 0) return;

    const currentData = dataRef.current;
    let foundPrimary: string | null = null;
    let foundSecondary: string | null = null;

    // v2.13.0 使用 Profile 進行動態識別
    for (const r of results) {
      if (r.codeResult.confidence < 0.6) continue;
      const text = r.codeResult.code as string;
      
      if (currentProfile.primaryValidator(text)) {
        foundPrimary = text;
      } else if (currentProfile.secondaryValidator(text, currentData.primary || "")) {
        foundSecondary = text;
      }
    }

    // 瞬發雙掃描 (如果 Profile 支援)
    if (currentIsDualMode && foundPrimary && foundSecondary && foundPrimary !== foundSecondary) {
      isProcessing.current = true;
      triggerVibrate(currentProfile.vibrationPattern);
      dataRef.current = { primary: foundPrimary, secondary: foundSecondary };
      setData({ primary: foundPrimary, secondary: foundSecondary });
      setScanStateSync("success");
      setTimeout(startCooldown, 50);
      return;
    }

    const firstMatch = results.find(r => r.codeResult.confidence >= 0.7);
    if (!firstMatch) return;
    const text = firstMatch.codeResult.code;

    if (!currentData.primary) {
      if (currentProfile.primaryValidator(text)) {
        isProcessing.current = true;
        triggerVibrate(60);
        currentData.primary = text;
        setData({ ...currentData });

        if (!currentIsDualMode) {
          setScanStateSync("success");
          setTimeout(startCooldown, 50);
        } else {
          setScanStateSync("scanning-b");
          setTimeout(() => { if (isMounted.current) isProcessing.current = false; }, 1500);
        }
      }
    } else if (currentIsDualMode && !currentData.secondary && currentProfile.secondaryValidator(text, currentData.primary)) {
      isProcessing.current = true;
      triggerVibrate(currentProfile.vibrationPattern);
      currentData.secondary = text;
      setData({ ...currentData });
      setScanStateSync("success");
      setTimeout(startCooldown, 50);
    }
  }, [setScanStateSync, startCooldown]);

  const startScanning = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;

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

    await new Promise(r => setTimeout(r, 300));

    try {
      if (!isMounted.current) return;

      const Quagga = await getQuagga();
      if (!Quagga) throw new Error("Quagga unavailable");

      // v2.13.0 依據 Profile 動態配置 readers
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
          readers: profileRef.current.readers,
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
  }, [elementId, handleDetected, getQuagga, setScanStateSync]);

  const skipSecondary = useCallback(() => {
    if (dataRef.current.primary) {
      isProcessing.current = true;
      setScanStateSync("success");
      setTimeout(startCooldown, 50);
    }
  }, [setScanStateSync, startCooldown]);

  // 同步 refs
  useEffect(() => {
    isDualModeRef.current = isDualMode;
  }, [isDualMode]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
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
