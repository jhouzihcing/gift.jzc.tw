/**
 * useDriveSync — v2.12.0 極速閃電版 (Lightning Edition)
 *
 * 設計原則：
 * 1. 速度優先 (Speed First)：預設執行「盲目寫入 (Blind Write)」，將通訊次數降為 1。
 * 2. 全域佇列 (Global Singleton)：使用 Zustand 的 syncQueue 管理，徹底消除競爭。
 * 3. 智能恢復：僅在偵測到衝突 (412) 時自動降級為「讀取-合併-重寫」。
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
  } = useCardStore();

  const fileIdRef      = useRef<string | null>(null);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerBusyRef  = useRef(false);

  // ─── 閃電同步核心 ─────────────────────────────────────
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
      // 我們相信本地狀態是完整的。
      const currentDB = {
        version: 1,
        lastModified: Date.now(),
        cards: storeCards.map(({ isSynced: _, ...c }) => c) as any,
        customMerchants: useCardStore.getState().customMerchants,
      };

      try {
        await writeDriveDB(user.driveToken, fileIdRef.current, currentDB, user.uid);
      } catch (writeErr: any) {
        // 🛡️ 如果發生衝突 (412) 或特殊錯誤，降級為安全模式
        if (writeErr.message?.includes("412") || writeErr.message?.includes("404")) {
          console.warn("[Sync] 寫入衝突，啟動恢復模式...");
          const { db: remoteDb } = await readDriveDB(user.driveToken, fileIdRef.current, user.uid);
          
          // 合併衝突：以本地變更覆蓋雲端同 ID 卡片
          for (const localCard of batchCards) {
             const { isSynced: _, ...cardData } = localCard as any;
             const idx = remoteDb.cards.findIndex(c => c.id === cardData.id);
             if (idx !== -1) remoteDb.cards[idx] = cardData;
             else remoteDb.cards.push(cardData);
          }
          await writeDriveDB(user.driveToken, fileIdRef.current, remoteDb, user.uid);
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
      console.log(`[Sync] ⚡ 閃電同步完成 (${batchIds.length} 張)`);

    } catch (e: any) {
      console.error("[Sync] ❌ 閃電同步失敗:", e.message || e);
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
      // 若處理期間又有新東西進來，立即再跑一輪
      if (useCardStore.getState().syncQueue.length > 0) {
        setTimeout(() => processQueue(), 100);
      }
    }
  }, [user?.driveToken, user?.uid, syncQueue, storeCards, setGlobalSyncing, removeFromQueue, markCardSynced, setSyncStatus, setSyncError]);

  // ─── 初始化與對齊 ───────────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const init = async () => {
      setSyncStatus(true, null);
      try {
        await (useCardStore.persist as any).rehydrate();
        await migrateOldVisibleFile(user.driveToken!);
        const fileId = await getOrCreateDriveFile(user.driveToken!, user.uid);
        fileIdRef.current = fileId;

        // 初始化時才執行昂貴的 Read-Merge
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
        console.log("[Sync] 🏁 初始化校對完成。");
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

  // ─── 監聽佇列變動自動啟動 ──────────────────────────
  useEffect(() => {
    if (isInitialized && fileIdRef.current && syncQueue.length > 0) {
      processQueue();
    }
  }, [syncQueue, isInitialized, processQueue]);
}
