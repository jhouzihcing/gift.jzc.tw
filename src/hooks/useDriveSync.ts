/**
 * useDriveSync — v2.15.0 同步穩定性強化版 (Infinity Stability Edition)
 *
 * 設計原則：
 * 1. 雙軌自癒 (Self-Healing)：同時檢查顯性與隱性空間，自動對齊遺失或過舊的檔案。
 * 2. 根目錄強制化 (Root Forcing)：確保顯性檔案位於根目錄，解決跨裝置不可見問題。
 * 3. 診斷支援：提供前端展示當前運行的 File ID。
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
} from "@/lib/driveFile";

const MAX_BACKOFF_MS = 60_000;

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError } = useAuthStore();
  const {
    cards: storeCards,
    setCards,
    markCardSynced,
    isInitialized,
    finishInitialization,
    addCustomMerchant,
    syncQueue,
    isGlobalSyncing,
    setGlobalSyncing,
    removeFromQueue,
    setCloudFileIds,
  } = useCardStore();

  const fileIdRef      = useRef<{ visible: string | null; hidden: string | null }>({ visible: null, hidden: null });
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerBusyRef  = useRef(false);

  // ─── 穩定同步核心 ─────────────────────────────────────
  const processQueue = useCallback(async () => {
    if (workerBusyRef.current || syncQueue.length === 0) return;
    if (!fileIdRef.current.visible || !user?.driveToken || !user?.uid) return;

    workerBusyRef.current = true;
    setGlobalSyncing(true);
    setSyncStatus(true, useAuthStore.getState().lastSync);

    const batchIds = [...syncQueue];
    
    try {
      // ⚡ 第 1 步：發送至顯性檔案 (VISIBLE) - 優先恢復綠燈
      const currentDB = {
        version: 1,
        lastModified: Date.now(),
        cards: storeCards.map(({ isSynced: _, ...c }) => c) as any,
        customMerchants: useCardStore.getState().customMerchants,
      };

      await writeDriveDB(user.driveToken, fileIdRef.current.visible, currentDB, user.uid);
      
      // 🎉 此時顯性成功，立即標記前端為已同步（綠燈）
      removeFromQueue(batchIds);
      batchIds.forEach(id => markCardSynced(id, true));
      setSyncStatus(false, Date.now());
      setSyncError(false);
      retryCountRef.current = 0;

      // 🛡️ 第 2 步：背景發送至隱性檔案 (HIDDEN) - 非阻塞
      if (fileIdRef.current.hidden) {
        writeDriveDB(user.driveToken, fileIdRef.current.hidden, currentDB, user.uid).catch(err => {
           console.warn("[Sync] 背景備援同步失敗，將由下次初始化補正：", err);
        });
      }

    } catch (e: any) {
      console.error("[Sync] ❌ 同步失敗:", e.message || e);
      setSyncStatus(false, useAuthStore.getState().lastSync);
      setSyncError(true);

      const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), MAX_BACKOFF_MS);
      retryCountRef.current = Math.min(retryCountRef.current + 1, 5);
      
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        workerBusyRef.current = false;
        processQueue();
      }, delay);
    } finally {
      workerBusyRef.current = false;
      setGlobalSyncing(false);
      if (useCardStore.getState().syncQueue.length > 0) {
        setTimeout(() => processQueue(), 100);
      }
    }
  }, [user?.driveToken, user?.uid, syncQueue, storeCards, setGlobalSyncing, removeFromQueue, markCardSynced, setSyncStatus, setSyncError]);

  // ─── 初始化與對齊 (核心自癒邏輯) ────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const init = async () => {
      setSyncStatus(true, null);
      try {
        await (useCardStore.persist as any).rehydrate();
        await migrateOldVisibleFile(user.driveToken!);
        
        // 1. 同時取得兩個空間的 File ID
        const [visibleId, hiddenId] = await Promise.all([
          getOrCreateDriveFile(user.driveToken!, user.uid, 'drive'),
          getOrCreateDriveFile(user.driveToken!, user.uid, 'appDataFolder')
        ]);
        fileIdRef.current = { visible: visibleId, hidden: hiddenId };
        setCloudFileIds({ visible: visibleId, hidden: hiddenId });

        // 2. 獲取兩邊的資料內容與準確時間
        const [vRes, hRes] = await Promise.allSettled([
          readDriveDB(user.driveToken!, visibleId, user.uid),
          readDriveDB(user.driveToken!, hiddenId, user.uid)
        ]);

        let finalDB: any = null;
        let vTime = 0;
        let hTime = 0;

        if (vRes.status === 'fulfilled') vTime = vRes.value.lastModifiedTime;
        if (hRes.status === 'fulfilled') hTime = hRes.value.lastModifiedTime;

        // 3. 自癒對齊：以最新時間戳記為準
        if (vTime >= hTime && vRes.status === 'fulfilled') {
          finalDB = vRes.value.db;
          // 若隱性檔案落後，背景更新它
          if (hTime < vTime && hRes.status === 'fulfilled') {
            writeDriveDB(user.driveToken!, hiddenId, finalDB, user.uid).catch(() => {});
          }
        } else if (hRes.status === 'fulfilled') {
          finalDB = hRes.value.db;
          // 若顯性檔案落後（或缺失），立即或背景修復它
          if (vTime < hTime) {
             console.log("[Sync] 檢測到顯性檔案落後於隱性備份，正在啟動修復...");
             await writeDriveDB(user.driveToken!, visibleId, finalDB, user.uid);
          }
        } else if (vRes.status === 'fulfilled') {
          finalDB = vRes.value.db;
        } else {
          throw new Error("無法從兩邊讀取任何資料");
        }

        // 4. 定期大掃除並更新本地 Store
        const { db: cleanedDb, changed } = cleanupTrash(finalDB);
        const localCards = useCardStore.getState().cards;
        const cardMap = new Map<string, any>();
        cleanedDb.cards.forEach((c) => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter((c) => !c.isSynced).forEach((c) => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()));
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach((m) => addCustomMerchant(m));
        }

        if (changed) {
          await writeDriveDB(user.driveToken!, visibleId, cleanedDb, user.uid);
        }

        setSyncStatus(false, Date.now());
        console.log("[Sync] 🏁 自癒型初始化校對完成。");
      } catch (err: any) {
        console.error("[Sync] ⚠️ 初始化校對失敗:", err.message || err);
        setSyncStatus(false, null);
        setSyncError(true);
      } finally {
        finishInitialization();
      }
    };

    init();
  }, [user?.driveToken]);

  useEffect(() => {
    if (isInitialized && fileIdRef.current.visible && syncQueue.length > 0) {
      processQueue();
    }
  }, [syncQueue, isInitialized, processQueue]);

  // 公開當前 File ID 用於診斷 (前端暫存)
  return { 
    visibleFileId: fileIdRef.current.visible, 
    hiddenFileId: fileIdRef.current.hidden 
  };
}
