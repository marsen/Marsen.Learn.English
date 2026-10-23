import { LOGIN_TOKEN_TTL_MINUTES } from "@/domain/auth/loginToken";

/**
 * 登入信：中文在前、英文在後，兩種語言都有（不管使用者的介面語言）。
 * 標題放登入碼，在收件匣就看得到。
 * HTML 版最上面是大字的登入碼；另附純文字版給不顯示 HTML 的信箱。
 * 信件不能用網站的 CSS token，顏色寫在 inline style（對應 globals.css 的 primary / muted）。
 */
export function loginCodeMail(code: string): {
  subject: string;
  text: string;
  html: string;
} {
  const m = LOGIN_TOKEN_TTL_MINUTES;
  const zh = [
    `你的登入碼是 ${code}。`,
    `回到網站輸入這組數字就能登入（${m} 分鐘內有效，只能用一次）。`,
    "如果不是你申請的，忽略這封信即可。",
  ];
  const en = [
    `Your login code is ${code}.`,
    `Enter this code on the website to log in (valid for ${m} minutes, one use only).`,
    "If you didn't request it, you can ignore this email.",
  ];

  const text = [code, "", ...zh, "", ...en].join("\n");

  const paragraph = (lines: string[]) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3a33">${lines
      .map(escapeHtml)
      .join("<br>")}</p>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f7f4ee;font-family:-apple-system,'Segoe UI','Noto Sans TC','PingFang TC',Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px">
<p style="margin:0 0 8px;font-size:13px;color:#7a7268">登入碼 Login code</p>
<div style="margin:0 0 28px;padding:16px 0;background:#fdf1e2;border-radius:10px;text-align:center;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#9a4f00">${escapeHtml(code)}</div>
${paragraph(zh)}
${paragraph(en)}
</div>
</body></html>`;

  return { subject: `登入碼 Login code：${code}`, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
