/**
 * useDriveSync — v2.18.0 重心轉移版 (Hidden Residency Edition)
 *
 * 設計原則：
 * 1. AppData 唯一真理：隱藏空間為主要讀取來源，解決跨裝置搜尋不到檔案的問題。
 * 2. 顯性鏡像備份：同時寫入根目錄可見檔案，方便使用者手動查看。
 * 3. 單向遷移：若隱藏空間為空但顯性空間有資料，自動執行一次性遷移。
 */

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import {
  getOrCreateDriveFile,
  readDriveDB,
  writeDriveDB,
  cleanupTrash,
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

  const hiddenIdRef    = useRef<string | null>(null);
  const visibleIdRef   = useRef<string | null>(null);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerBusyRef  = useRef(false);

  // 雙發寫入 (Double-Write)
  const processQueue = useCallback(async () => {
    if (workerBusyRef.current || syncQueue.length === 0) return;
    if (!hiddenIdRef.current || !user?.driveToken || !user?.uid) return;

    workerBusyRef.current = true;
    setGlobalSyncing(true);
    setSyncStatus(true, useAuthStore.getState().lastSync);

    const batchIds = [...syncQueue];
    const batchCards = storeCards.filter(c => batchIds.includes(c.id));
    
    try {
      const currentDB = {
        version: 1,
        lastModified: Date.now(),
        cards: storeCards.map(({ isSynced: _, ...c }) => c) as any,
        customMerchants: useCardStore.getState().customMerchants,
      };

      // ⚡ 優先寫入隱藏空間 (Primary Source)
      await writeDriveDB(user.driveToken, hiddenIdRef.current, currentDB, user.uid);
      
      // ⚡ 背景寫入顯性空間 (Mirror Backup)
      if (visibleIdRef.current) {
        writeDriveDB(user.driveToken, visibleIdRef.current, currentDB, user.uid).catch(e => {
          console.warn("[Sync] 顯性鏡像寫入失敗 (非致命):", e.message);
        });
      }

      removeFromQueue(batchIds);
      batchIds.forEach(id => markCardSynced(id, true));
      
      setSyncStatus(false, Date.now());
      setSyncError(false);
      retryCountRef.current = 0;
      console.log(`[Sync] v2.18.0 AppData 同步成功 (${batchIds.length} 張)`);

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

  // ─── 初始化邏輯 (AppData 優先 + 顯性遷移) ──────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const init = async () => {
      setSyncStatus(true, null);
      try {
        await (useCardStore.persist as any).rehydrate();
        
        // 1. 同時獲取兩個空間的 ID
        const [hid, vid] = await Promise.all([
          getOrCreateDriveFile(user.driveToken!, user.uid, 'appDataFolder'),
          getOrCreateDriveFile(user.driveToken!, user.uid, 'drive')
        ]);
        
        hiddenIdRef.current = hid;
        visibleIdRef.current = vid;
        setCloudFileIds({ visible: vid, hidden: hid });

        // 2. 獲取資料
        let primarySource = await readDriveDB(user.driveToken!, hid, user.uid);
        
        // 🚀 遷移邏輯：如果 AppData 是空的（剛轉移版本），但顯性空間有資料，則執行遷移
        if (primarySource.db.cards.length === 0) {
          try {
            const legacySource = await readDriveDB(user.driveToken!, vid, user.uid);
            if (legacySource.db.cards.length > 0) {
              console.log("[Sync] 偵測到顯性舊資料，正在執行單向遷移至 AppData...");
              primarySource = legacySource;
              // 立即同步回 AppData
              await writeDriveDB(user.driveToken!, hid, primarySource.db, user.uid);
            }
          } catch (e) {
            console.warn("[Sync] 顯性遷移讀取失敗 (可能無檔案):", e);
          }
        }

        const { db: cleanedDb, changed } = cleanupTrash(primarySource.db);

        const localCards = useCardStore.getState().cards;
        const cardMap = new Map<string, any>();
        cleanedDb.cards.forEach((c) => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter((c) => !c.isSynced).forEach((c) => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()));
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach((m) => addCustomMerchant(m));
        }

        if (changed) {
          await writeDriveDB(user.driveToken!, hid, cleanedDb, user.uid);
        }

        setSyncStatus(false, Date.now());
        console.log("[Sync] v2.18.0 AppData 初始化校對完成。");
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
    if (isInitialized && hiddenIdRef.current && syncQueue.length > 0) {
      processQueue();
    }
  }, [syncQueue, isInitialized, processQueue]);
}
