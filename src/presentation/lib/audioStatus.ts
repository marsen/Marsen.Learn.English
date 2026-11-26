/** 播放器讀錄音的狀態：只看瀏覽器給的兩個欄位，方便測試。 */
export type AudioLike = {
  error: { code: number } | null;
  networkState: number;
};

/** HTMLMediaElement.NETWORK_NO_SOURCE：找不到能播的來源（例如 404） */
const NETWORK_NO_SOURCE = 3;

/**
 * 錄音讀不到了嗎？播放器出錯，或找不到能播的來源，都算讀不到。
 * 頁面接手前錯誤就可能已經發生（錄音回得很快），所以接手後要用這個再檢查一次。
 */
export function isAudioUnreadable(el: AudioLike): boolean {
  return el.error !== null || el.networkState === NETWORK_NO_SOURCE;
}
