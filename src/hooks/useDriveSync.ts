/**
 * useDriveSync — v2.21.0 帳號自動校準版 (Autoconverge Edition)
 *
 * 設計原則：
 * 1. 雙金鑰救援：優先使用穩定 UID，失敗時自動使用 Email 救援。
 * 2. 登入即對齊：只要 Google 帳號相同，兩台設備應能達成 100% 同步成功率。
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
import { getKeyHash } from "@/lib/crypto";

const MAX_BACKOFF_MS = 60_000;

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError, syncOverrideUid } = useAuthStore();
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

  // v2.21.0: 優先順序：手動覆寫 > 系統穩定 UID > 
  const effectiveUid = syncOverrideUid || user?.uid;
  // 救援金鑰通常為 Email，因為帳號相同則 Email 必同
  const fallbackUid = user?.email || undefined;

  // 雙發寫入 (Double-Write)
  const processQueue = useCallback(async () => {
    if (workerBusyRef.current || syncQueue.length === 0) return;
    if (!hiddenIdRef.current || !user?.driveToken || !effectiveUid) return;

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

      addSyncLog(`🔼 執行寫入 (主金鑰: ${syncOverrideUid ? "手動貼上" : "Google 穩定 ID"})`);
      
      await writeDriveDB(user.driveToken, hiddenIdRef.current, currentDB, effectiveUid, addSyncLog);
      
      if (visibleIdRef.current) {
        writeDriveDB(user.driveToken, visibleIdRef.current, currentDB, effectiveUid).catch(e => {
          console.warn("[Sync] 鏡像覆蓋跳過:", e.message);
        });
      }

      removeFromQueue(batchIds);
      batchIds.forEach(id => markCardSynced(id, true));
      
      setSyncStatus(false, Date.now());
      setSyncError(false);
      retryCountRef.current = 0;
      addSyncLog(`✅ 同步完成。`);

    } catch (e: any) {
      addSyncLog(`❌ 寫入失敗: ${e.message || e}`);
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
  }, [user?.driveToken, effectiveUid, syncQueue, storeCards, syncOverrideUid, setGlobalSyncing, removeFromQueue, markCardSynced, setSyncStatus, setSyncError, addSyncLog]);

  // ─── 初始化邏輯 (階層式對齊版) ──────────────────────────
  useEffect(() => {
    if (!user?.driveToken || !effectiveUid) return;

    const init = async () => {
      setSyncStatus(true, null);
      
      const kh = await getKeyHash(effectiveUid);
      addSyncLog(`🛡️ 當前角色金鑰指紋: [${kh}]`);
      if (fallbackUid) addSyncLog(`🩹 已備妥 Email 救援金鑰模式。`);

      try {
        await (useCardStore.persist as any).rehydrate();
        
        addSyncLog(`📡 正在與雲端建立連線...`);
        const [hid, vid] = await Promise.all([
          getOrCreateDriveFile(user.driveToken!, effectiveUid, 'appDataFolder', addSyncLog),
          getOrCreateDriveFile(user.driveToken!, effectiveUid, 'drive', addSyncLog)
        ]);
        
        hiddenIdRef.current = hid;
        visibleIdRef.current = vid;
        setCloudFileIds({ visible: vid, hidden: hid });

        addSyncLog(`📥 正在拉取數據庫...`);
        // v2.21.0: 傳入 fallbackUid 實現自動校準
        let primarySource = await readDriveDB(user.driveToken!, hid, effectiveUid, addSyncLog, fallbackUid);
        
        // 遷移邏輯
        if (primarySource.db.cards.length === 0) {
          addSyncLog(`☁️ AppData 無資料，檢查顯性空間...`);
          try {
            const legacySource = await readDriveDB(user.driveToken!, vid, effectiveUid, addSyncLog, fallbackUid);
            if (legacySource.db.cards.length > 0) {
              addSyncLog(`🔄 發現可用資料，執行自動遷移對齊。`);
              primarySource = legacySource;
              await writeDriveDB(user.driveToken!, hid, primarySource.db, effectiveUid, addSyncLog);
            }
          } catch (e) {
            addSyncLog(`⚠️ 無法從顯性空間找回資料。`);
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
          await writeDriveDB(user.driveToken!, hid, cleanedDb, effectiveUid, addSyncLog);
        }

        setSyncStatus(false, Date.now());
        addSyncLog(`🏁 帳號校準成功，同步已就緒。`);
      } catch (err: any) {
        addSyncLog(`🔥 初始化失敗: ${err.message || err}`);
        setSyncStatus(false, null);
        setSyncError(true);
      } finally {
        finishInitialization();
      }
    };

    init();
  }, [user?.driveToken, effectiveUid, syncOverrideUid, fallbackUid]);

  useEffect(() => {
    if (isInitialized && hiddenIdRef.current && syncQueue.length > 0) {
      processQueue();
    }
  }, [syncQueue, isInitialized, processQueue]);
}
