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

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError } = useAuthStore();
  const { setCards, markCardSynced, isInitialized, finishInitialization, addCustomMerchant } = useCardStore();
  
  const fileIdRef = useRef<string | null>(null);
  const etagRef = useRef<string | null>(null);

  const writeInProgress = useRef(false);
  const pendingCards = useRef<DriveCard[]>([]);

  // ─── 核心寫入器（地表最快版：1 讀 1 寫）─────────────────────────────
  const flushPending = useCallback(async () => {
    if (writeInProgress.current || pendingCards.current.length === 0) return;
    if (!user?.driveToken || !fileIdRef.current) return;

    writeInProgress.current = true;
    const cardsToSync = [...pendingCards.current];
    pendingCards.current = [];

    try {
      setSyncStatus(true, useAuthStore.getState().lastSync);
      
      // 1. 同步讀取（確版本對齊，支援防快取）
      const { db, etag } = await readDriveDB(user.driveToken, fileIdRef.current, user.uid);
      etagRef.current = etag;

      // 2. 注入變動
      for (const card of cardsToSync) {
        const { isSynced: _, ...cardData } = card as any;
        const idx = db.cards.findIndex(c => c.id === cardData.id);
        if (idx !== -1) db.cards[idx] = cardData;
        else db.cards.push(cardData);
      }

      // 3. 寫入雲端（單軌極速）
      const newEtag = await writeDriveDB(user.driveToken, fileIdRef.current, db, user.uid, etagRef.current || undefined);
      etagRef.current = newEtag;

      // 4. 標記成功並釋放 UI
      for (const card of cardsToSync) markCardSynced(card.id, true);
      setSyncStatus(false, Date.now());

    } catch (e: any) {
      console.error("[Drive Sync] Flush failed:", e);
      pendingCards.current = [...cardsToSync, ...pendingCards.current];
      if (e.message !== "SYNC_CONFLICT") setSyncError(true);
    } finally {
      writeInProgress.current = false;
      // 檢查是否還有新任務
      setTimeout(() => {
        if (!writeInProgress.current && pendingCards.current.length > 0) flushPending();
      }, 300);
    }
  }, [user?.driveToken, markCardSynced, setSyncStatus, setSyncError]);

  // ─── 1. 初始化：極速載入流程 ─────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const initDrive = async () => {
      try {
        setSyncStatus(true, null);
        setSyncError(false);

        await (useCardStore.persist as any).rehydrate();

        // A. 檔名遷移 (英文優先標竿)
        await migrateOldVisibleFile(user.driveToken!);

        // B. 尋找根目錄檔案
        const fileId = await getOrCreateDriveFile(user.driveToken!);
        fileIdRef.current = fileId;

        // C. 讀取資料
        const { db, etag } = await readDriveDB(user.driveToken!, fileId, user.uid);
        etagRef.current = etag;

        // D. 垃圾桶與本地合併
        const { db: cleanedDb, changed } = cleanupTrash(db);
        const { cards: localCards } = useCardStore.getState();
        const cardMap = new Map();
        cleanedDb.cards.forEach(c => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter(c => !c.isSynced).forEach(c => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()) as any);
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach(m => addCustomMerchant(m));
        }

        // 若清理了垃圾，回寫一次
        if (changed) {
          const newEtag = await writeDriveDB(user.driveToken!, fileId, cleanedDb, user.uid, etagRef.current || undefined);
          etagRef.current = newEtag;
        }

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
    const timer = setInterval(processQueue, 30000); // 30 秒定期掃描
    processQueue();
    return () => clearInterval(timer);
  }, [user?.driveToken, isInitialized, flushPending]);

  const syncImmediately = useCallback(async (card: any) => {
    if (!user?.driveToken || !fileIdRef.current) return;
    pendingCards.current.push(card);
    flushPending();
  }, [user?.driveToken, flushPending]);

  return { syncImmediately };
}
