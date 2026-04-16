/**
 * useDriveSync — v2.19.0 同步診斷版 (Diagnostic Edition)
 *
 * 設計原則：
 * 1. 深度日誌化：記錄每一個網路與加解密細節，供使用者截圖偵錯。
 * 2. 多重備索：當常規搜尋失敗時，報告空間內的所有檔案狀態。
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
    addSyncLog,
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

      addSyncLog(`🔼 正在執行雲端更新 (批次大小: ${batchIds.length})`);
      
      // ⚡ 優先寫入隱藏空間 (Primary Source)
      await writeDriveDB(user.driveToken, hiddenIdRef.current, currentDB, user.uid, addSyncLog);
      
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
      addSyncLog(`✅ 同步任務圓滿完成。`);

    } catch (e: any) {
      addSyncLog(`❌ 同步過程中斷: ${e.message || e}`);
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
  }, [user?.driveToken, user?.uid, syncQueue, storeCards, setGlobalSyncing, removeFromQueue, markCardSynced, setSyncStatus, setSyncError, addSyncLog]);

  // ─── 初始化邏輯 (AppData 優先 + 顯性遷移 + 完整日誌) ──────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const init = async () => {
      setSyncStatus(true, null);
      addSyncLog(`🏁 啟動 v2.19.0 初始化校對儀 (UID: ${user.uid?.slice(0, 8)}...)`);
      
      try {
        await (useCardStore.persist as any).rehydrate();
        
        // 1. 同時獲取兩個空間的 ID
        addSyncLog(`📡 正在偵測雲端連結狀態...`);
        const [hid, vid] = await Promise.all([
          getOrCreateDriveFile(user.driveToken!, user.uid, 'appDataFolder', addSyncLog),
          getOrCreateDriveFile(user.driveToken!, user.uid, 'drive', addSyncLog)
        ]);
        
        hiddenIdRef.current = hid;
        visibleIdRef.current = vid;
        setCloudFileIds({ visible: vid, hidden: hid });

        // 2. 獲取主空間資料 (HIDDEN)
        addSyncLog(`💾 正在加載隱藏空間數據資料庫...`);
        let primarySource = await readDriveDB(user.driveToken!, hid, user.uid, addSyncLog);
        
        // 🚀 遷移邏輯：如果 AppData 是空的（剛轉移版本），但顯性空間有資料，則執行遷移
        if (primarySource.db.cards.length === 0) {
          addSyncLog(`☁️ 隱藏空間為空，正在檢查是否有顯性資料可遷移...`);
          try {
            const legacySource = await readDriveDB(user.driveToken!, vid, user.uid, addSyncLog);
            if (legacySource.db.cards.length > 0) {
              addSyncLog(`🔄 發現 ${legacySource.db.cards.length} 張舊卡片，自動執行一鍵遷移！`);
              primarySource = legacySource;
              await writeDriveDB(user.driveToken!, hid, primarySource.db, user.uid, addSyncLog);
            } else {
              addSyncLog(`ℹ️ 雲端並無舊資料庫。`);
            }
          } catch (e) {
            addSyncLog(`⚠️ 顯性搜尋略過 (可能權限不足)`);
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
          addSyncLog(`🧹 正在執行過期卡片清理...`);
          await writeDriveDB(user.driveToken!, hid, cleanedDb, user.uid);
        }

        setSyncStatus(false, Date.now());
        addSyncLog(`🏁 初始化校對圓滿成功。`);
      } catch (err: any) {
        addSyncLog(`🔥 初始化失敗: ${err.message || err}`);
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
