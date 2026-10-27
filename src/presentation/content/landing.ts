/**
 * 首頁（Landing Page）的結構：錨點、圖示、色調、各段的項目。
 * 中文／英文文案在翻譯檔 landing.*（messages/<語言>.json），改文字只動翻譯檔。
 * 「先試做一題」的錄音和題目在 landingDemo.json（scripts/make-landing-demo.mjs 從題組剪出來）。
 */
export const LANDING = {
  /** 導覽列：key 對應 landing.nav.<key> */
  nav: [
    { href: "#features", key: "features" },
    { href: "#how", key: "how" },
    { href: "#demo", key: "demo" },
    { href: "#faq", key: "faq" },
  ],

  /** 特色：key 對應 landing.features.items.<key>.title／body */
  features: [
    { key: "unlimited", icon: "repeat", tone: "primary" },
    { key: "realPace", icon: "clock", tone: "accent" },
    { key: "instantGrading", icon: "check", tone: "primary" },
    { key: "weakTraps", icon: "chart", tone: "accent" },
  ],

  /** 三步驟：對應 landing.steps.items.<key>.title／body */
  steps: ["open", "listen", "review"],

  /** 常見問題：對應 landing.faq.items.<key>.q／a */
  faq: ["price", "author", "score"],
} as const;
