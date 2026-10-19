// 公開設定（可以放進 git）。管理金鑰絕對不能放在這裡。
// supabaseUrl 留空 = 本機開發模式（只在 localhost 有效，用假後端與假登入）。
export const config = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  contactEmail: "", // 頁面底部「要求刪除資料」的信箱；上線前必填
};
