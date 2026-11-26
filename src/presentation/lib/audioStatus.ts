/** 播放器讀錄音的狀態：只看瀏覽器給的欄位，方便測試。 */
export type AudioLike = {
  error: { code: number } | null;
};

/**
 * 錄音讀不到了嗎？播放器用 src 載入，讀不到時瀏覽器一定會設 error。
 * 不看 networkState：剛開始載入時它會短暫是 NETWORK_NO_SOURCE，會誤判、閃一下「讀不到」。
 * 頁面接手前錯誤就可能已經發生（錄音回得很快），所以接手後要用這個再檢查一次。
 */
export function isAudioUnreadable(el: AudioLike): boolean {
  return el.error !== null;
}
