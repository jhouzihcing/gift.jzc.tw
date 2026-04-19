/**
 * useDriveSync — {VERSION} 極簡版 (Sync Revamp)
 *
 * 核心原則：
 * 1. 回歸純粹：僅使用 Email 作為同步金鑰，實現帳號即金鑰。
 * 2. 自動過渡：背景自動將舊版 UID 資料轉換為新版 Email 格式。
 */

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { VERSION } from "@/constants/version";
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

  // v2.23.0 標準：唯一金鑰種子即是 Email
  const primaryEmail = user?.email;
  const legacyUid = user?.uid;

  // 雙發寫入
  const processQueue = useCallback(async () => {
    if (workerBusyRef.current || syncQueue.length === 0) return;
    if (!hiddenIdRef.current || !user?.driveToken || !primaryEmail) return;

    workerBusyRef.current = true;
    setGlobalSyncing(true);
    setSyncStatus(true, useAuthStore.getState().lastSync);

    const batchIds = [...syncQueue];
    
    try {
      const currentDB = {
        version: 1,
        lastModified: Date.now(),
        cards: storeCards.map(({ isSynced: _, ...c }) => c) as any,
        customMerchants: useCardStore.getState().customMerchants,
      };

      await writeDriveDB(user.driveToken, hiddenIdRef.current, currentDB, primaryEmail, addSyncLog);
      
      if (visibleIdRef.current) {
        writeDriveDB(user.driveToken, visibleIdRef.current, currentDB, primaryEmail).catch(() => {});
      }

      removeFromQueue(batchIds);
      batchIds.forEach(id => markCardSynced(id, true));
      
      setSyncStatus(false, Date.now());
      setSyncError(false);
      retryCountRef.current = 0;
      addSyncLog(`✅ 已同步。`);

    } catch (e: any) {
      addSyncLog(`❌ 同步失敗: ${e.message || e}`);
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
  }, [user?.driveToken, primaryEmail, syncQueue, storeCards, setGlobalSyncing, removeFromQueue, markCardSynced, setSyncStatus, setSyncError, addSyncLog]);

  // ─── 初始化邏輯 (極簡遷移版) ──────────────────────────
  useEffect(() => {
    if (!user?.driveToken || !primaryEmail) return;

    const init = async () => {
      setSyncStatus(true, null);
      
      try {
        await (useCardStore.persist as any).rehydrate();
        
        // 1. 建立連結
        const [hid, vid] = await Promise.all([
          getOrCreateDriveFile(user.driveToken!, primaryEmail, 'appDataFolder', addSyncLog),
          getOrCreateDriveFile(user.driveToken!, primaryEmail, 'drive', addSyncLog)
        ]);
        
        hiddenIdRef.current = hid;
        visibleIdRef.current = vid;
        setCloudFileIds({ visible: vid, hidden: hid });

        // 2. 數據對齊
        const { db: cloudDb, keyMigrated } = await readDriveDB(user.driveToken!, hid, primaryEmail, addSyncLog, legacyUid);
        let currentSourceDb = cloudDb;

        // 若偵測到金鑰需要遷移，執行一次轉換寫入
        if (keyMigrated) {
          addSyncLog(`🔄 正在優化資料格式以適配新版同步...`);
          await writeDriveDB(user.driveToken!, hid, currentSourceDb, primaryEmail, addSyncLog);
        }
        
        // 遷移邏輯 (檢查 Visible)
        if (currentSourceDb.cards.length === 0) {
          try {
            const { db: legacyDb } = await readDriveDB(user.driveToken!, vid, primaryEmail, addSyncLog, legacyUid);
            if (legacyDb.cards.length > 0) {
              addSyncLog(`🔄 發現舊資料，執行自動遷移。`);
              currentSourceDb = legacyDb;
              await writeDriveDB(user.driveToken!, hid, currentSourceDb, primaryEmail, addSyncLog);
            }
          } catch (e) {
             // 略過
          }
        }

        const { db: cleanedDb, changed } = cleanupTrash(currentSourceDb);

        const localCards = useCardStore.getState().cards;
        const cardMap = new Map<string, any>();
        cleanedDb.cards.forEach((c) => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter((c) => !c.isSynced).forEach((c) => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()));
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach((m) => addCustomMerchant(m));
        }

        if (changed) {
          await writeDriveDB(user.driveToken!, hid, cleanedDb, primaryEmail);
        }

        setSyncStatus(false, Date.now());
        addSyncLog(`🏁 ZJ Card ${VERSION} 同步已就緒。`);
      } catch (err: any) {
        addSyncLog(`🔥 初始化失敗: ${err.message || err}`);
        setSyncStatus(false, null);
        setSyncError(true);
      } finally {
        finishInitialization();
      }
    };

    init();
  }, [user?.driveToken, primaryEmail, legacyUid]);

  useEffect(() => {
    if (isInitialized && hiddenIdRef.current && syncQueue.length > 0) {
      processQueue();
    }
  }, [syncQueue, isInitialized, processQueue]);
}
