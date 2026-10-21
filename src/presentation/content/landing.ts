/**
 * 首頁（Landing Page）的所有文字。暫用文案，Marsen 之後會自己改；
 * 改文字只動這個檔案，版面元件不用碰。
 */
export const LANDING = {
  brand: "無限雅思聽力",
  nav: [
    { href: "#features", label: "特色" },
    { href: "#how", label: "怎麼練" },
    { href: "#demo", label: "試做一題" },
    { href: "#faq", label: "常見問題" },
  ],
  navCta: "免費試寫",
  login: "登入",

  hero: {
    badge: "Section 1・表格填空",
    titleLines: ["每一回都是新題目的", "雅思聽力模擬測試"],
    lead: "照正式考試的節奏：看題時間、錄音只播一次、最後檢查。寫完立刻批改，看見自己卡在哪一種陷阱。",
    cta: "免費試寫一回",
    secondary: "先試做一題 →",
    note: "不用註冊就能試寫，約 6 分鐘。",
    illustration: "[在此處放入微日系Q 版耳機插圖]",
    playingTag: "錄音播放中",
  },

  features: {
    title: "為什麼在這裡練",
    lead: "題庫不會被寫完，每一回都能當成第一次。",
    items: [
      {
        icon: "repeat",
        tone: "primary",
        title: "無限新題",
        body: "情境、人名、數字每回都不同，不會因為背過答案而失準。",
      },
      {
        icon: "clock",
        tone: "accent",
        title: "真實考試節奏",
        body: "看題停頓、錄音只播一次、最後檢查，全程跟著時間軸走。",
      },
      {
        icon: "check",
        tone: "primary",
        title: "交卷立刻批改",
        body: "大小寫、日期寫法都照規則比對，每題對錯一目了然。",
      },
      {
        icon: "chart",
        tone: "accent",
        title: "看見弱點陷阱",
        body: "說錯再更正、相近數字、拼字……知道自己最常掉進哪一種。",
      },
    ],
  },

  steps: {
    title: "三步驟開始練習",
    items: [
      { title: "打開一回試題", body: "不用註冊，按下開始就進入考試。" },
      { title: "邊聽邊填答案卷", body: "畫面會提示看題時間，該看的空格自動標亮。" },
      { title: "看分數與正解", body: "免費註冊就能看每題正解，並保留練習紀錄。" },
    ],
  },

  demo: {
    title: "先試做一題",
    lead: "這是示意，錄音以文字代替。讀完對話，把答案填進空格。",
    idle: "按播放開始（只播一次）",
    playing: "播放中，邊聽邊填。",
    ended: "錄音結束，檢查你的答案。",
    submit: "交卷",
    paperTitle: "Fitness Club Registration",
    instruction: "Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
    lines: [
      "Receptionist: Could I have your address, please?",
      "Member: Sure, it's forty-seven… sorry, thirty-seven Maple Court.",
      "Receptionist: And when would you like to train? We have evening classes.",
      "Member: Evenings are busy for me. Mornings would be best.",
    ],
  },

  faq: {
    title: "常見問題",
    items: [
      { q: "要付費嗎？", a: "試寫免費、不用註冊。註冊後可以寫更多回並看正解。" },
      {
        q: "題目是誰出的？",
        a: "依雅思 Section 1 的格式產生，並由老師審過才會開放練習。",
      },
      {
        q: "分數代表我的雅思成績嗎？",
        a: "不代表。這是練習用的模擬，跟正式考試的評分無關。",
      },
    ],
  },

  finalCta: {
    title: "現在就寫一回看看",
    lead: "6 分鐘、10 題、立刻知道結果。",
    cta: "開始免費試寫",
  },

  footer: {
    disclaimer: "本網站與 IELTS 官方無關，模擬成績不代表正式分數。",
  },
} as const;
