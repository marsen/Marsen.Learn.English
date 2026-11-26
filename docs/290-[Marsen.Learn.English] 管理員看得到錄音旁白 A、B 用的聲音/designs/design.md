# Design: 管理員看得到錄音旁白 A、B 用的聲音

**來源**：issue #290 的驗收條件 AC-1～6（判級 `build`：寫 design、不寫 spec）。從 `origin/main` 開 `feat/290-narrator-voices`（交辦時指定，不疊在 #294 上）。

## 查證結果（寫 design 前先看資料）

- 2.x（單段）：`answers.cast` 上傳時整份原樣存進私密部分（`exam_set_private.answers`），已上傳的資料就讀得到。舊資料沒有 `engine`。
- 3.0（完整考卷）：`cast` 在每段的 `sections[i].answers.cast`，但網站的轉換（`fullExamJson.ts`）只留 `answers.answers`，**`cast` 被丟掉了**。所以已經上傳的完整考卷（例如 `s1-tour-0002`），資料庫裡沒有旁白資料。
- 出題工具實際產出的欄位：`id`、`engine`（kokoro／breeze／higgs，S1 舊資料沒有）、`ref`（breeze、higgs 才有）、`accent`、`gender`（m／f）、`age`（young／middle／old）、`can_spell`、`speller`。

## 決定紀錄

| 要決定 | 選了 | 為什麼 |
| --- | --- | --- |
| 完整考卷的旁白存哪 | 轉換時把每段的 `cast` 放進製作紀錄 `provenance.sections[i].cast`（每段本來就存一份原樣的製作紀錄） | 不改資料表、不加 migration（AC-5），只是 JSON 欄位多存一個鍵。放製作紀錄比放答案卡合理：旁白是「怎麼做出來的」。2.x 照舊讀 `answers.cast` |
| 已經上傳的完整考卷 | 每段顯示「未記錄」，旁邊寫「重新上傳（覆蓋）後才看得到」 | 資料庫裡本來就沒有，網站讀不到；不去補資料庫（AC-5）。覆蓋上傳會回到待審，是否重傳由 Marsen 決定 |
| 放審稿頁哪裡 | 標題下面那一行（代號 · 幾題）的下方，一個預設收起來的「錄音旁白」折疊區 | 只是參考資料，不搶審稿的版面；不放進 `ReviewForm`，不碰錄音列、分頁、暫存（#285、#286、#288 不會壞），也少跟 #294 衝突 |
| 老師看不看得到 | **看不到**，只有管理員看得到（`uploadSets` 權限，和刪除鈕同一個判斷） | 老師審的是「考生聽起來如何」，引擎名稱對審稿沒幫助，還可能先入為主（看到某引擎就覺得不自然）；issue 標題就是「管理員」。不新增權限 |
| 誰能打開審稿頁 | 不變（要有審稿權限）；管理員要同時是老師才進得去，例如 admin@marsen.me | 不改權限 |
| 學生 | 看不到：審稿頁本來就擋學生；資料只在伺服器判斷是管理員後才放進頁面 | AC-4 |
| 列哪幾位 | `cast` 裡單一大寫字母的鍵（A、B…）照字母排；只有 A 就只列 A | AC-1；不寫死只有 A、B |
| 顯示哪些欄位 | 引擎、聲音（`id`）、口音、性別、年齡 | AC-1。`ref` 已含在 `id` 裡、`can_spell` 跟聲音無關，不列 |
| 缺欄位 | 一律「未記錄」；整段沒有 `cast` 也寫「未記錄」 | AC-3，不能出現 undefined |
| 性別、年齡 | 認得的翻成文字（男／女、年輕／中年／年長），不認得的原樣顯示 | 出題工具之後加新值也不會壞 |
| 段落 | 完整考卷照 Section 1～4 各列一段（標「Section n」）；2.x 不標段落 | AC-2 |
| 手機 390px | 每位旁白一行，欄位用 `flex-wrap` 換行，不用表格 | AC-6 |

## 內容

- `src/application/examSet/narratorVoices.ts`（純函式，單元測試）
  - `narratorVoicesOf(secret, fullExam: boolean): SectionVoices[]`
  - `SectionVoices = { ieltsSection: number | null; narrators: Narrator[] }`
  - `Narrator = { role: string; engine; voice; accent; gender; age }`，每個欄位是 `string | null`
  - 2.x：讀 `answers.cast`，回一段（`ieltsSection: null`）
  - 3.0：讀 `provenance.sections[]`，照 `ielts_section` 排，每段讀 `cast`
  - 欄位型別不對（不是字串）當作沒有，不丟錯
- `fullExamJson.ts`：`provenance.sections` 每段多放 `cast`（有才放）
- `GetExamSetForReview`：結果多一個 `voices`，只有 `uploadSets` 權限才有，其他人是 `null`
- 頁面 `admin/sets/[setId]/page.tsx`：`voices` 不是 null 才畫 `NarratorVoices`
- `src/presentation/components/admin/review/NarratorVoices.tsx`（`"use client"`）：`<details>` 收起來，打開才列
- 翻譯 `review.voices.*`（en、zh-TW）；性別、年齡放 `review.voices`（只有這裡用）

## 測試

- `narratorVoices.test.ts`：2.x 兩位、一位、沒有 `cast`、缺 `engine`、欄位型別不對；3.0 四段照順序、某段沒有 `cast`
- `uploadFullExam.test.ts`：上傳後 `provenance.sections[i].cast` 有存
- `reviewFlow.test.ts`：管理員（兼老師）拿得到 `voices`、只有老師是 `null`

## 不做

- 補已上傳完整考卷的旁白（要改資料庫或重傳）
- 改出題工具輸出、換聲音、重新產生錄音（issue「不在這張」）
