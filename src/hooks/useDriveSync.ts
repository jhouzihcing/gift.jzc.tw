/**
 * useDriveSync — v2.11.0 響應式同步引擎
 *
 * 設計原則：
 * 1. 響應式觸發：透過 useCardStore 訂閱偵測未同步卡片，自動入隊
 * 2. 讀先寫後 (Read-first)：每次寫入前必定先讀取 Drive 最新狀態並合併
 * 3. 指數退避：失敗後依次等待 2s → 4s → 8s → 16s → 32s → 60s（上限）再重試
 * 4. 單一鎖定：busyRef 防止並行寫入；佇列確保任何中途加入的卡片不漏掉
 * 5. 無 etag：讀先寫後已保證資料一致性，不需要衝突偵測
 */

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import {
  getOrCreateDriveFile,
  readDriveDB,
  writeDriveDB,
  cleanupTrash,
  migrateOldVisibleFile,
  DriveCard,
} from "@/lib/driveFile";

const MAX_BACKOFF_MS = 60_000;
const SAFETY_NET_INTERVAL_MS = 60_000;

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError } = useAuthStore();
  const {
    cards: storeCards,
    setCards,
    markCardSynced,
    isInitialized,
    finishInitialization,
    addCustomMerchant,
  } = useCardStore();

  // ─── 內部狀態 refs（不觸發 re-render）─────────────────────────────────
  const fileIdRef      = useRef<string | null>(null);
  const busyRef        = useRef(false);
  const queueRef       = useRef<DriveCard[]>([]);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保持對最新 doSync 的引用，供 setTimeout 回調使用
  const doSyncRef = useRef<() => Promise<void>>(async () => {});

  // ─── 核心同步：讀取 → 合併 → 寫入 ─────────────────────────────────────
  const doSync = useCallback(async () => {
    // 前置守衛
    if (busyRef.current || queueRef.current.length === 0) return;
    if (!fileIdRef.current || !user?.driveToken || !user?.uid) return;

    // 取消待執行的重試計時器
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    busyRef.current = true;
    const batch = [...queueRef.current];
    queueRef.current = [];
    setSyncStatus(true, useAuthStore.getState().lastSync);

    try {
      // 步驟 1：從 Drive 讀取最新狀態（保證不用舊快取）
      const { db } = await readDriveDB(user.driveToken, fileIdRef.current, user.uid);

      // 步驟 2：將本地變更合併進去（本地版本優先，依 ID 覆蓋）
      for (const card of batch) {
        const { isSynced: _ignored, ...cardData } = card as any;
        const idx = db.cards.findIndex((c) => c.id === cardData.id);
        if (idx !== -1) db.cards[idx] = cardData;
        else db.cards.push(cardData);
      }
      db.lastModified = Date.now();

      // 步驟 3：將合併後的資料庫寫回 Drive
      await writeDriveDB(user.driveToken, fileIdRef.current, db, user.uid);

      // 步驟 4：標記成功
      for (const card of batch) markCardSynced(card.id, true);
      setSyncStatus(false, Date.now());
      setSyncError(false);
      retryCountRef.current = 0;
      console.log(`[Sync] ✅ Synced ${batch.length} card(s)`);

    } catch (e: any) {
      console.error("[Sync] ❌ Failed:", e.message || e);
      // 將本批次卡片放回佇列最前面（保留稍後加入的不影響順序）
      queueRef.current = [...batch, ...queueRef.current];
      setSyncStatus(false, useAuthStore.getState().lastSync);
      setSyncError(true);

      // 指數退避：2s → 4s → 8s → 16s → 32s → 60s（上限）
      const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), MAX_BACKOFF_MS);
      retryCountRef.current = Math.min(retryCountRef.current + 1, 5);
      console.log(`[Sync] Retry in ${delay / 1000}s (attempt ${retryCountRef.current})`);

      retryTimerRef.current = setTimeout(() => {
        setSyncError(false);
        doSyncRef.current();
      }, delay);

    } finally {
      busyRef.current = false;
      // 若同步過程中有新卡片加入佇列，立即接著處理
      if (queueRef.current.length > 0) {
        setTimeout(() => doSyncRef.current(), 0);
      }
    }
  }, [user?.driveToken, user?.uid, markCardSynced, setSyncStatus, setSyncError]);

  // 保持 ref 永遠指向最新的 doSync（供 setTimeout 回調使用）
  useEffect(() => {
    doSyncRef.current = doSync;
  }, [doSync]);

  // ─── 初始化：從 Drive 載入，與本地合併 ───────────────────────────────
  useEffect(() => {
    if (!user?.driveToken) {
      // 登出時清理所有狀態
      fileIdRef.current = null;
      queueRef.current = [];
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      return;
    }

    const init = async () => {
      setSyncStatus(true, null);
      setSyncError(false);

      try {
        // 確保本地持久化資料已還原
        await (useCardStore.persist as any).rehydrate();

        // 遷移舊版檔名（若有）
        await migrateOldVisibleFile(user.driveToken!);

        // 取得或建立 Drive 檔案
        const fileId = await getOrCreateDriveFile(user.driveToken!, user.uid);
        fileIdRef.current = fileId;

        // 從 Drive 讀取最新資料庫
        const { db } = await readDriveDB(user.driveToken!, fileId, user.uid);
        const { db: cleanedDb, changed } = cleanupTrash(db);

        // 合併策略：Drive 卡片（標記已同步）+ 本地未同步卡片（保留）
        const { cards: localCards } = useCardStore.getState();
        const cardMap = new Map<string, any>();
        cleanedDb.cards.forEach((c) => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter((c) => !c.isSynced).forEach((c) => cardMap.set(c.id, c));
        setCards(Array.from(cardMap.values()));

        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach((m) => addCustomMerchant(m));
        }

        // 若垃圾桶有被清理，將清理後的版本寫回 Drive
        if (changed) {
          await writeDriveDB(user.driveToken!, fileId, cleanedDb, user.uid);
        }

        setSyncStatus(false, Date.now());
        console.log("[Sync] ✅ Init complete");
      } catch (err: any) {
        console.error("[Sync] ❌ Init failed:", err.message || err);
        setSyncStatus(false, null);
        setSyncError(true);
      } finally {
        finishInitialization();
      }
    };

    init();
  // 刻意只在 driveToken 改變時重新初始化（避免其他依賴項觸發不必要的重新初始化）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.driveToken]);

  // ─── 響應式觸發：偵測到未同步卡片時自動入隊 ──────────────────────────
  useEffect(() => {
    if (!isInitialized || !fileIdRef.current || !user?.driveToken) return;

    const unsynced = storeCards.filter((c) => !c.isSynced) as DriveCard[];
    if (unsynced.length === 0) return;

    // 去重：只加入尚未在佇列中的卡片
    const newToQueue = unsynced.filter(
      (c) => !queueRef.current.some((q) => q.id === c.id)
    );
    if (newToQueue.length > 0) {
      queueRef.current = [...queueRef.current, ...newToQueue];
      doSync();
    }
  }, [storeCards, isInitialized, user?.driveToken, doSync]);

  // ─── 背景安全網（每 60 秒）：確保任何漏網之魚都能同步 ─────────────────
  useEffect(() => {
    if (!isInitialized || !user?.driveToken) return;

    const checkUnsynced = () => {
      const all = useCardStore.getState().cards.filter((c) => !c.isSynced) as DriveCard[];
      const newToQueue = all.filter(
        (c) => !queueRef.current.some((q) => q.id === c.id)
      );
      if (newToQueue.length > 0) {
        console.log(`[Sync] Safety net: queueing ${newToQueue.length} unsynced card(s)`);
        queueRef.current = [...queueRef.current, ...newToQueue];
        doSyncRef.current();
      }
    };

    const timer = setInterval(checkUnsynced, SAFETY_NET_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isInitialized, user?.driveToken]);
}
