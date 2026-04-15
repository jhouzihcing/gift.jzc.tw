import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import {
  getOrCreateDriveFile,
  readDriveDB,
  writeDriveDB,
  cleanupTrash,
  DriveCard,
} from "@/lib/driveFile";

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError } = useAuthStore();
  const { setCards, markCardSynced, isInitialized, finishInitialization, addCustomMerchant } = useCardStore();
  const fileIdRef = useRef<string | null>(null);
  const etagRef = useRef<string | null>(null);

  // 寫入鎖：防止並發寫入造成資料競爭
  const writeInProgress = useRef(false);
  // 等待寫入的卡片隊列
  const pendingCards = useRef<DriveCard[]>([]);

  // ─── 核心寫入器（序列化，防競爭）────────────────────────────────
  const flushPending = useCallback(async () => {
    if (writeInProgress.current || pendingCards.current.length === 0) return;
    if (!user?.driveToken || !fileIdRef.current) return;

    writeInProgress.current = true;
    const cardsToSync = [...pendingCards.current];
    pendingCards.current = [];

    try {
      setSyncStatus(true, useAuthStore.getState().lastSync);
      
      // 讀取一次 → 批量更新記憶體 → 寫入一次
      const { db, etag } = await readDriveDB(user.driveToken, fileIdRef.current, user.uid);
      etagRef.current = etag;

      for (const card of cardsToSync) {
        // 移除前端專用欄位，只存純資料
        const { isSynced: _, ...cardData } = card as any;
        const idx = db.cards.findIndex(c => c.id === cardData.id);
        if (idx !== -1) {
          db.cards[idx] = cardData;
        } else {
          db.cards.push(cardData);
        }
      }

      const newEtag = await writeDriveDB(user.driveToken, fileIdRef.current, db, user.uid, etagRef.current || undefined);
      etagRef.current = newEtag;

      // 標記這批卡片已同步
      for (const card of cardsToSync) {
        markCardSynced(card.id, true);
      }

      setSyncStatus(false, Date.now());
    } catch (e: any) {
      console.error("[Drive Sync] Flush failed:", e);
      
      // 如果是衝突，立即觸發一次重新同步
      if (e.message === "SYNC_CONFLICT") {
        console.warn("[Drive Sync] Detect conflict, retrying...");
        writeInProgress.current = false;
        pendingCards.current = [...cardsToSync, ...pendingCards.current];
        flushPending();
        return;
      }
      // 寫入失敗：把這批卡片塞回隊列等待重試
      pendingCards.current = [...cardsToSync, ...pendingCards.current];
      for (const card of cardsToSync) {
        markCardSynced(card.id, false);
      }
      setSyncError(true);
    } finally {
      writeInProgress.current = false;

      // 若在寫入期間又有新的待處理卡片，繼續 flush
      if (pendingCards.current.length > 0) {
        flushPending();
      }
    }
  }, [user?.driveToken, markCardSynced, setSyncStatus, setSyncError]);

  // ─── 1. 初始化：找到或建立 Drive JSON 檔案，載入資料 ────────────
  useEffect(() => {
    if (!user?.driveToken) return;

    const initDrive = async () => {
      try {
        setSyncStatus(true, null);
        setSyncError(false);

        // --- 新增：手動觸發本地持有的加密資料還原 ---
        // 因為一開始加載時 UID 為空無法解密，現在登入了，必須強制重新載入本地資料
        await (useCardStore.persist as any).rehydrate();

        const fileId = await getOrCreateDriveFile(user.driveToken!, user.uid);
        fileIdRef.current = fileId;

        const { db, etag } = await readDriveDB(user.driveToken!, fileId, user.uid);
        etagRef.current = etag;

        // 垃圾桶大掃除（15 天）
        const { db: cleanedDb, changed } = cleanupTrash(db);

        // --- 優化邏輯：合併本地未同步的變動，避免 refresh 時丟失 ---
        const { cards: localCards } = useCardStore.getState();
        const localUnsynced = localCards.filter(c => !c.isSynced);

        // 建立 ID 對應，方便合併
        const cardMap = new Map();

        // 1. 先放雲端資料（視為已同步）
        cleanedDb.cards.forEach(c => {
          cardMap.set(c.id, {
            ...c,
            name: c.merchant === "7-11" ? "7-11 商品卡" : `${c.merchant} 禮物卡`,
            isSynced: true,
          });
        });

        // 2. 用本地未同步資料覆寫（代表更鮮鮮的本地變動，如：剛剛扔進垃圾桶）
        localUnsynced.forEach(c => {
          cardMap.set(c.id, c);
        });

        const mergedCards = Array.from(cardMap.values());
        setCards(mergedCards as any);

        // 同步 customMerchants（跨裝置支援）
        if (cleanedDb.customMerchants?.length > 0) {
          for (const m of cleanedDb.customMerchants) {
            addCustomMerchant(m);
          }
        }

        // 若清理了過期卡片，回寫雲端
        if (changed) {
          const newEtag = await writeDriveDB(user.driveToken!, fileId, cleanedDb, user.uid, etagRef.current || undefined);
          etagRef.current = newEtag;
        }

        setSyncStatus(false, Date.now());
      } catch (error: any) {
        console.error("[Drive Init] Error:", error);
        setSyncStatus(false, null);
        if (error.message?.includes("401")) setSyncError(true);
      } finally {
        // 無論如何都完成初始化，讓本地快取可用
        finishInitialization();
      }
    };

    initDrive();
  }, [user?.driveToken, setCards, setSyncStatus, setSyncError, finishInitialization]);

  // ─── 2. 背景補傳隊列：每 30 秒掃描未同步卡片 ───────────────────
  useEffect(() => {
    if (!user?.driveToken || !isInitialized) return;

    const processQueue = () => {
      const { cards } = useCardStore.getState();
      const unsyncedCards = cards.filter(c => !c.isSynced) as DriveCard[];
      if (unsyncedCards.length === 0) return;

      console.log(`[Drive Queue] Found ${unsyncedCards.length} unsynced cards.`);
      // 加入隊列並觸發 flush
      pendingCards.current.push(...unsyncedCards);
      flushPending();
    };

    const timer = setInterval(processQueue, 30000);
    processQueue(); // 啟動時立即執行一次
    return () => clearInterval(timer);
  }, [user?.driveToken, isInitialized, flushPending]);

  // ─── 3. 即時同步（非阻塞，加入隊列後立即嘗試 flush）────────────
  const syncImmediately = useCallback(async (card: any) => {
    if (!user?.driveToken || !fileIdRef.current) {
      // 沒有 token 或檔案 ID，等背景隊列處理
      return;
    }
    pendingCards.current.push(card);
    flushPending();
  }, [user?.driveToken, flushPending]);

  return { syncImmediately };
}
