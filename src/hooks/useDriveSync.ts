"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { findBackupFile, downloadBackup, uploadBackup } from "@/lib/gdrive";

export function useDriveSync() {
  const { user, setSyncStatus } = useAuthStore();
  const { cards, customMerchants, setCards } = useCardStore();
  const fileIdRef = useRef<string | null>(null);
  
  // 1. 初始化：登入後自動從雲端載入最新存檔
  useEffect(() => {
    if (!user?.driveToken) return;

    const initSync = async () => {
      try {
        setSyncStatus(true, null);
        const fileId = await findBackupFile(user.driveToken!);
        if (fileId) {
          fileIdRef.current = fileId;
          const remoteData = await downloadBackup(user.driveToken!, fileId);
          if (remoteData && remoteData.cards) {
            // 採取簡單模式：如果本地是空的才自動覆蓋
            const localCardsCount = useCardStore.getState().cards.length;
            if (localCardsCount === 0) {
               setCards(remoteData.cards);
               if (remoteData.customMerchants) {
                  useCardStore.setState({ customMerchants: remoteData.customMerchants });
               }
            }
          }
        }
        setSyncStatus(false, Date.now());
      } catch (error) {
        console.error("GDrive Init Sync Error:", error);
        setSyncStatus(false, null);
      }
    };

    initSync();
  }, [user?.driveToken, setCards, setSyncStatus]);

  // 2. 自動備份：當卡片資料變動時，防抖上傳至雲端
  useEffect(() => {
    if (!user?.driveToken) return;
    
    const timer = setTimeout(async () => {
      try {
        setSyncStatus(true, useAuthStore.getState().lastSync);
        const content = {
          cards,
          customMerchants,
          updatedAt: Date.now(),
        };
        const result = await uploadBackup(user.driveToken!, content, fileIdRef.current || undefined);
        if (result.id) fileIdRef.current = result.id;
        setSyncStatus(false, Date.now());
      } catch (error) {
        console.error("GDrive Auto Backup Error:", error);
        setSyncStatus(false, useAuthStore.getState().lastSync);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [cards, customMerchants, user?.driveToken, setSyncStatus]);

  return null;
}
