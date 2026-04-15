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
  DriveDB,
} from "@/lib/driveFile";

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError, setSyncCard } = useAuthStore();
  const { setCards, markCardSynced, isInitialized, finishInitialization, addCustomMerchant } = useCardStore();
  
  const fileIdRef = useRef<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const dbRef = useRef<DriveDB | null>(null);

  const writeInProgress = useRef(false);
  const pendingCards = useRef<DriveCard[]>([]);

  // ─── 核心寫入器（閃電快傳版：跳過重複讀取，直擊寫入）─────────────────────────────
  const flushPending = useCallback(async () => {
    if (writeInProgress.current || pendingCards.current.length === 0) return;
    if (!user?.driveToken || !fileIdRef.current) return;

    writeInProgress.current = true;
    const cardsToSync = [...pendingCards.current];
    pendingCards.current = [];

    try {
      setSyncStatus(true, useAuthStore.getState().lastSync);
      
      // 1. 取得基本資料庫（若無則從雲端讀取一次，之後都走樂觀模式）
      let db: DriveDB;
      if (!dbRef.current) {
        const res = await readDriveDB(user.driveToken, fileIdRef.current, user.uid);
        db = res.db;
        etagRef.current = res.etag;
        dbRef.current = db;
      } else {
        db = dbRef.current;
      }

      // 2. 注入變動到記憶體
      for (const card of cardsToSync) {
        const { isSynced: _, ...cardData } = card as any;
        const idx = db.cards.findIndex(c => c.id === cardData.id);
        if (idx !== -1) db.cards[idx] = cardData;
        else db.cards.push(cardData);
      }

      // 3. 閃電寫入：直接噴發到雲端，跳過「寫前讀取」
      try {
        const newEtag = await writeDriveDB(user.driveToken, fileIdRef.current, db, user.uid, etagRef.current || undefined);
        etagRef.current = newEtag;
        dbRef.current = db; // 更新本地最新副本
      } catch (writeErr: any) {
        // 如果發生衝突 (412)，代表雲端有更老的版本，此時才乖乖回去讀取合併
        if (writeErr.message === "SYNC_CONFLICT") {
          console.warn("[Drive Flash Sync] Conflict detected, falling back to read-merge-write.");
          const res = await readDriveDB(user.driveToken, fileIdRef.current, user.uid);
          const freshDb = res.db;
          
          // 重新合併變動
          for (const card of cardsToSync) {
            const { isSynced: _, ...cardData } = card as any;
            const idx = freshDb.cards.findIndex(c => c.id === cardData.id);
            if (idx !== -1) freshDb.cards[idx] = cardData;
            else freshDb.cards.push(cardData);
          }

          const finalEtag = await writeDriveDB(user.driveToken, fileIdRef.current, freshDb, user.uid, res.etag);
          etagRef.current = finalEtag;
          dbRef.current = freshDb;
        } else {
          throw writeErr;
        }
      }

      // 4. 標記成功並釋放 UI
      for (const card of cardsToSync) markCardSynced(card.id, true);
      setSyncStatus(false, Date.now());

    } catch (e: any) {
      console.error("[Drive Sync] Flash Sync failed:", e);
      pendingCards.current = [...cardsToSync, ...pendingCards.current];
      // 重置 isSyncing，否則 UI 會永遠卡在「同步中」
      setSyncStatus(false, useAuthStore.getState().lastSync);
      if (e.message !== "SYNC_CONFLICT") setSyncError(true);
    } finally {
      writeInProgress.current = false;
      setTimeout(() => {
        if (!writeInProgress.current && pendingCards.current.length > 0) flushPending();
      }, 300);
    }
  }, [user?.driveToken, markCardSynced, setSyncStatus, setSyncError]);

  // ─── 1. 初始化：載入並填充記憶體緩存 ─────────────────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const initDrive = async () => {
      try {
        setSyncStatus(true, null);
        setSyncError(false);

        await (useCardStore.persist as any).rehydrate();

        await migrateOldVisibleFile(user.driveToken!);
        const fileId = await getOrCreateDriveFile(user.driveToken!);
        fileIdRef.current = fileId;

        const { db, etag } = await readDriveDB(user.driveToken!, fileId, user.uid);
        etagRef.current = etag;
        dbRef.current = db; // 初始填充緩存，這讓之後的 flush 速度極快

        const { db: cleanedDb, changed } = cleanupTrash(db);
        const { cards: localCards } = useCardStore.getState();
        const cardMap = new Map();
        cleanedDb.cards.forEach(c => cardMap.set(c.id, { ...c, isSynced: true }));
        localCards.filter(c => !c.isSynced).forEach(c => cardMap.set(c.id, c));
        
        setCards(Array.from(cardMap.values()) as any);
        if (cleanedDb.customMerchants) {
          cleanedDb.customMerchants.forEach(m => addCustomMerchant(m));
        }

        if (changed) {
          const newEtag = await writeDriveDB(user.driveToken!, fileId, cleanedDb, user.uid, etagRef.current || undefined);
          etagRef.current = newEtag;
          dbRef.current = cleanedDb;
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
    const timer = setInterval(processQueue, 30000);
    processQueue();
    return () => clearInterval(timer);
  }, [user?.driveToken, isInitialized, flushPending]);

  const syncImmediately = useCallback(async (card: any) => {
    if (!user?.driveToken || !fileIdRef.current) return;
    pendingCards.current.push(card);
    flushPending();
  }, [user?.driveToken, flushPending]);

  // 將 syncImmediately 注冊到全域 store，讓其他元件無需建立第二個 hook 實例
  useEffect(() => {
    setSyncCard(syncImmediately);
    return () => setSyncCard(null);
  }, [syncImmediately, setSyncCard]);

  return { syncImmediately };
}
