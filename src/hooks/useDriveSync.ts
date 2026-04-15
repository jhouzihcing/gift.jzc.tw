import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import {
  getOrCreateDriveFiles,
  readDualDB,
  writeDriveFile,
  createDriveFile,
  cleanupTrash,
  migrateOldVisibleFile,
  DriveCard,
  DriveFileIds,
} from "@/lib/driveFile";

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError } = useAuthStore();
  const { setCards, markCardSynced, isInitialized, finishInitialization, addCustomMerchant } = useCardStore();
  
  const idsRef = useRef<DriveFileIds>({ hiddenId: null, visibleId: null });
  const etagsRef = useRef<{ hidden?: string; visible?: string }>({});

  const writeInProgress = useRef(false);
  const pendingCards = useRef<DriveCard[]>([]);

  // ─── 核心寫入器（前景優先，背景分發）─────────────────────────────
  const flushPending = useCallback(async () => {
    if (writeInProgress.current || pendingCards.current.length === 0) return;
    const { visibleId, hiddenId } = idsRef.current;
    if (!user?.driveToken || !visibleId) return;

    writeInProgress.current = true;
    const cardsToSync = [...pendingCards.current];
    pendingCards.current = [];

    try {
      setSyncStatus(true, useAuthStore.getState().lastSync);
      
      // 1. 同步讀取（確版本對齊）
      const { db, hiddenEtag: hEtag, visibleEtag: vEtag } = await readDualDB(user.driveToken, user.uid, idsRef.current);
      etagsRef.current = { hidden: hEtag, visible: vEtag };

      // 2. 注入變動
      for (const card of cardsToSync) {
        const { isSynced: _, ...cardData } = card as any;
        const idx = db.cards.findIndex(c => c.id === cardData.id);
        if (idx !== -1) db.cards[idx] = cardData;
        else db.cards.push(cardData);
      }

      // 3. 前景同步：僅等待「可見檔案」成功
      const newVisibleEtag = await writeDriveFile(user.driveToken, visibleId, db, user.uid, etagsRef.current.visible);
      etagsRef.current.visible = newVisibleEtag;

      // 標記成功並釋放 UI
      for (const card of cardsToSync) markCardSynced(card.id, true);
      setSyncStatus(false, Date.now());

      // 4. 背景同步：不等待隱藏空間結果
      if (hiddenId) {
        writeDriveFile(user.driveToken, hiddenId, db, user.uid, etagsRef.current.hidden)
          .then(newHEtag => {
            etagsRef.current.hidden = newHEtag;
            console.log("[Drive Background] Hidden backup success.");
          })
          .catch(err => {
            console.warn("[Drive Background] Hidden backup failed (silent):", err);
          });
      }

    } catch (e: any) {
      console.error("[Drive Sync] Flush failed:", e);
      pendingCards.current = [...cardsToSync, ...pendingCards.current];
      if (e.message !== "SYNC_CONFLICT") setSyncError(true);
      
      // 發生衝突時，下一輪會自動重新讀取合併
    } finally {
      writeInProgress.current = false;
      // 檢查是否還有新任務
      setTimeout(() => {
        if (!writeInProgress.current && pendingCards.current.length > 0) flushPending();
      }, 300);
    }
  }, [user?.driveToken, markCardSynced, setSyncStatus, setSyncError]);

  // ─── 1. 初始化：遷移、搜尋與對齊 ─────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const initDrive = async () => {
      try {
        setSyncStatus(true, null);
        setSyncError(false);

        await (useCardStore.persist as any).rehydrate();

        // A. 檔名遷移 (中文 -> 英文)
        await migrateOldVisibleFile(user.driveToken!);

        // B. 尋找 ID 
        const ids = await getOrCreateDriveFiles(user.driveToken!);
        idsRef.current = ids;

        // C. 雙端讀取與自動修復
        const { db, hiddenEtag, visibleEtag, needsRepair } = await readDualDB(user.driveToken!, user.uid, ids);
        etagsRef.current = { hidden: hiddenEtag, visible: visibleEtag };

        // D. 建立缺失端 (雙重保險自動修復)
        if (needsRepair || (!ids.hiddenId && !ids.visibleId)) {
          let targetHiddenId = ids.hiddenId;
          let targetVisibleId = ids.visibleId;

          if (!targetHiddenId) {
            targetHiddenId = await createDriveFile(user.driveToken!, user.uid, db, "appDataFolder", "sgcm-data.json");
          }
          if (!targetVisibleId) {
            targetVisibleId = await createDriveFile(user.driveToken!, user.uid, db, "drive", "zj-card-sync.json");
          }
          idsRef.current = { hiddenId: targetHiddenId, visibleId: targetVisibleId };
          
          // 強制對齊一次
          const finalTags = await Promise.all([
            writeDriveFile(user.driveToken!, idsRef.current.hiddenId!, db, user.uid),
            writeDriveFile(user.driveToken!, idsRef.current.visibleId!, db, user.uid)
          ]);
          etagsRef.current = { hidden: finalTags[0], visible: finalTags[1] };
        }

        // E. 垃圾桶與本地合併
        const { db: cleanedDb, changed } = cleanupTrash(db);
        const { cards: localCards } = useCardStore.getState();
        const cardMap = new Map();
        cleanedDb.cards.forEach(c => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter(c => !c.isSynced).forEach(c => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()) as any);
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach(m => addCustomMerchant(m));
        }

        if (changed) flushPending();

        setSyncStatus(false, Date.now());
      } catch (error: any) {
        console.error("[Drive Init] Error:", error);
        setSyncStatus(false, null);
      } finally {
        finishInitialization();
      }
    };

    initDrive();
  }, [user?.driveToken, setCards, setSyncStatus, setSyncError, finishInitialization]);

  // ─── 2. 背景定期補傳與即時介面 ─────────────────────────
  useEffect(() => {
    if (!user?.driveToken || !isInitialized) return;
    const processQueue = () => {
      const unsynced = useCardStore.getState().cards.filter(c => !c.isSynced) as DriveCard[];
      if (unsynced.length > 0) {
        pendingCards.current.push(...unsynced);
        flushPending();
      }
    };
    const timer = setInterval(processQueue, 30000);
    processQueue();
    return () => clearInterval(timer);
  }, [user?.driveToken, isInitialized, flushPending]);

  const syncImmediately = useCallback(async (card: any) => {
    if (!user?.driveToken || !idsRef.current.visibleId) return;
    pendingCards.current.push(card);
    flushPending();
  }, [user?.driveToken, flushPending]);

  return { syncImmediately };
}
