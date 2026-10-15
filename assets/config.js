// 上線前要改的設定都集中在這個檔案。
// 這個檔案會在 app.js 之前載入，送出時才讀取，所以可以在不改 app.js 的情況下調整。
window.WAITLIST_CONFIG = {
  // 表單接收端網址，例如 Formspree 的 https://formspree.io/f/xxxx，
  // 或 Google Forms 的 .../formResponse 網址。
  // 留空 = 本機測試模式：資料只存在這個瀏覽器的 localStorage，不會送到任何地方。
  formEndpoint: "",

  // "cors"：端點會回應 CORS 與 JSON（Formspree 這類）。
  // "no-cors"：端點不回應 CORS（Google Forms）；這時無法確認對方是否真的收到。
  formMode: "cors",

  // 欄位改名對照。Google Forms 要把欄位名稱換成 entry.123456789 這種格式。
  // 例：{ email: "entry.111", timeframe: "entry.222", page: "entry.333", src: "entry.444" }
  // 可用的欄位：email, timeframe, page, src, utm_source, utm_medium, utm_campaign, ref, submitted_at
  fieldMap: {},

  // 頁面上顯示的聯絡信箱（送出失敗、要求刪除資料時用到）。上線前必填。
  contactEmail: "",
};
