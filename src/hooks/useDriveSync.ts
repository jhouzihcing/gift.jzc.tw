"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { findBackupFile, downloadBackup, uploadBackup } from "@/lib/gdrive";

export function useDriveSync() {
  const { user, setSyncStatus, setSyncError } = useAuthStore();
  const { cards, customMerchants, setCards, isInitialized, finishInitialization } = useCardStore();
  const fileIdRef = useRef<string | null>(null);
  const isSyncSuccessRef = useRef(false);
  
  // 1. 初始化：登入後自動從雲端載入最新存檔
  useEffect(() => {
    if (!user?.driveToken) return;

    const initSync = async () => {
      try {
        setSyncStatus(true, null);
        setSyncError(false);
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
        
        isSyncSuccessRef.current = true;
        setSyncStatus(false, Date.now());
        finishInitialization(); // 只有成功握手（不論有無檔案）才標記完成
      } catch (error) {
        console.error("GDrive Init Sync Error:", error);
        setSyncStatus(false, null);
        setSyncError(true); // 發生錯誤（如 401），標記同步失敗，這會阻止後續空蓋雲端
      }
    };

    initSync();
  }, [user?.driveToken, setCards, setSyncStatus, setSyncError, finishInitialization]);

  // 2. 自動備份：當卡片資料變動時，防抖上傳至雲端
  useEffect(() => {
    // 安全檢查：沒 Token、沒初始化完成、或是在初始化時失敗，都禁止上傳
    if (!user?.driveToken || !isInitialized || !isSyncSuccessRef.current) return;
    
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
        setSyncError(false);
      } catch (error) {
        console.error("GDrive Auto Backup Error:", error);
        setSyncStatus(false, useAuthStore.getState().lastSync);
        // 如果是斷網或 Token 到期，顯示錯誤
        setSyncError(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [cards, customMerchants, user?.driveToken, setSyncStatus, setSyncError, isInitialized]);

  return null;
}
