/**
 * useDriveSync — v2.16.0 同步純淨版 (Sync Purist Edition)
 *
 * 設計原則：
 * 1. 顯性唯一 (Visible Only)：移除所有隱藏空間邏輯，確保只有一個真實檔案。
 * 2. 緩衝搜尋：增加重試延遲，解決多裝置同時啟動時的檔案重複問題。
 * 3. 穩定讀寫：優先保證根目錄資料的正確性與跨裝置可見度。
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

  const fileIdRef      = useRef<string | null>(null);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerBusyRef  = useRef(false);

  const processQueue = useCallback(async () => {
    if (workerBusyRef.current || syncQueue.length === 0) return;
    if (!fileIdRef.current || !user?.driveToken || !user?.uid) return;

    workerBusyRef.current = true;
    setGlobalSyncing(true);
    setSyncStatus(true, useAuthStore.getState().lastSync);

    const batchIds = [...syncQueue];
    const batchCards = storeCards.filter(c => batchIds.includes(c.id));
    
    try {
      // ⚡ 第 1 步：極速模式 - 直接嘗試寫入 (Blind Write)
      const currentDB = {
        version: 1,
        lastModified: Date.now(),
        cards: storeCards.map(({ isSynced: _, ...c }) => c) as any,
        customMerchants: useCardStore.getState().customMerchants,
      };

      try {
        await writeDriveDB(user.driveToken, fileIdRef.current, currentDB, user.uid);
      } catch (writeErr: any) {
        // 🛡️ 如果發生衝突 (412)，降級為安全模式 (Read-Merge-Write)
        if (writeErr.message?.includes("412") || writeErr.message?.includes("404")) {
          console.warn("[Sync] 寫入衝突或檔案丟失，嘗試恢復...");
          // 若是 404，重新搜尋 ID
          if (writeErr.message?.includes("404")) {
            fileIdRef.current = await getOrCreateDriveFile(user.driveToken, user.uid);
            setCloudFileIds({ visible: fileIdRef.current, hidden: null });
          }

          const { db: remoteDb } = await readDriveDB(user.driveToken, fileIdRef.current!, user.uid);
          
          for (const localCard of batchCards) {
             const { isSynced: _, ...cardData } = localCard as any;
             const idx = remoteDb.cards.findIndex(c => c.id === cardData.id);
             if (idx !== -1) remoteDb.cards[idx] = cardData;
             else remoteDb.cards.push(cardData);
          }
          await writeDriveDB(user.driveToken, fileIdRef.current!, remoteDb, user.uid);
        } else {
          throw writeErr;
        }
      }

      // 🎉 成功：清理佇列與標記
      removeFromQueue(batchIds);
      batchIds.forEach(id => markCardSynced(id, true));
      
      setSyncStatus(false, Date.now());
      setSyncError(false);
      retryCountRef.current = 0;
      console.log(`[Sync] v2.16.0 顯性同步完成 (${batchIds.length} 張)`);

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
  }, [user?.driveToken, user?.uid, syncQueue, storeCards, setGlobalSyncing, removeFromQueue, markCardSynced, setSyncStatus, setSyncError, setCloudFileIds]);

  // ─── 初始化邏輯 (單軌強化版) ──────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const init = async () => {
      setSyncStatus(true, null);
      try {
        await (useCardStore.persist as any).rehydrate();
        await migrateOldVisibleFile(user.driveToken!);
        
        // 1. 取得或搜尋唯一的顯性檔案
        const fileId = await getOrCreateDriveFile(user.driveToken!, user.uid);
        fileIdRef.current = fileId;
        setCloudFileIds({ visible: fileId, hidden: null });

        // 2. 獲取資料並進行 Read-Merge
        const { db } = await readDriveDB(user.driveToken!, fileId, user.uid);
        const { db: cleanedDb, changed } = cleanupTrash(db);

        const localCards = useCardStore.getState().cards;
        const cardMap = new Map<string, any>();
        cleanedDb.cards.forEach((c) => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter((c) => !c.isSynced).forEach((c) => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()));
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach((m) => addCustomMerchant(m));
        }

        if (changed) {
          await writeDriveDB(user.driveToken!, fileId, cleanedDb, user.uid);
        }

        setSyncStatus(false, Date.now());
        console.log("[Sync] v2.16.0 🏁 初始化校對完成。");
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
    if (isInitialized && fileIdRef.current && syncQueue.length > 0) {
      processQueue();
    }
  }, [syncQueue, isInitialized, processQueue]);
}
