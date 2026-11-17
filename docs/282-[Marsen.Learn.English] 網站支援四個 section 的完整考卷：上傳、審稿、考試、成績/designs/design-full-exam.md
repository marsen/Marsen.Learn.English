# Design: 網站支援四個 section 的完整考卷（set.json 3.0）

**來源**：issue #282 的驗收條件（判級 `build`：寫 design、不寫 spec）＋主管的決定（上傳上限 20MB、優先不改資料庫結構、先後順序）。格式以 Question.Generator 的 `docs/281-…/designs/design-full-paper.md`、`schema/exam.schema.json` 為準。

## 內容

### 怎麼存（不改資料庫結構、沒有 migration）

完整考卷照樣存成**一筆題組**（`set_id` 就是 3.0 的 `set_id`，例如 `s1-tour-0002`），上傳時把 3.0 轉成現有欄位認得的形狀：

| 欄位 | 2.x（不變） | 3.0 存法 |
| --- | --- | --- |
| `paper`（jsonb，考生看得到） | `form_table` | `{"sections": [{ielts_section, title, topic, first_question, last_question, blocks}]}`，**有 `sections` 就是完整考卷** |
| `answers`（jsonb，私密） | `{answers: [...]}` | 四段的 `answers[]` 接成一個陣列（每筆多帶 `ielts_section`），批改沿用原本的流程 |
| `transcript`（私密） | 2.1 起 | 四段的 `turns`、`evidence` 接起來（id 本來就有 `s2-` 前綴，不會撞） |
| `provenance`（私密） | 原樣 | `validate.ok`＝每段都 ok；`ai_review.verdict`＝最上層 `ai_review_verdict`；`ai_review.findings`、`warnings` 接起來（示警 id 加 `s<n>-` 前綴、每筆多帶 `ielts_section`）；原本每段的 provenance 原樣放在 `sections[]` |
| `topic` | 原樣 | 3.0 沒有最上層 topic，用 Section 1 的 topic |
| `timing`、`audio`、`question_count`、`title` | 原樣 | 原樣（時間軸本來就是一條） |

- 各段答對幾題、雅思級分都在**讀取時算**（題號 → 段落用 `paper.sections[].first_question/last_question`），作答紀錄的形狀不變，舊紀錄、舊成績不受影響。
- 上傳檢查：3.0 另有一份外型檢查（`fullExamJsonSchema`）；轉好之後走原本的檢查（錄音雜湊大小、`validate.ok`、AI 結論、答案卡、逐字稿和時間軸一一對應）。另檢查：choice 每題 3 個選項、matching 選項比項目多 ≥2、答案是選項裡的字母、題號全卷唯一。
- 大版號：網站改成收 2 和 3。
- 同一個 `set_id` 已經有 2.x 題組（`s1-tour-0002` 就是）：照現有規則要勾「覆蓋」，整套換成完整考卷、待審、下架。舊作答的分數照舊；成績頁發現作答沒涵蓋每一段時，不分段、不換算級分。

### 批改

- 新答案規則 `letter`：只比字母，大小寫和前後空白不算（`" b "` 對 `B`）。
- 題號：`grade()` 照答案卡順序編號（1–40），完整考卷的答案卡本來就照全卷題號排。

### 雅思級分（**估算**）

答對題數 → 級分（滿分 40 題才顯示）：

| 答對 | 39–40 | 37–38 | 35–36 | 32–34 | 30–31 | 26–29 | 23–25 | 18–22 | 16–17 | 13–15 | 10–12 | 8–9 | 6–7 | 4–5 | 2–3 | 1 | 0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 級分 | 9 | 8.5 | 8 | 7.5 | 7 | 6.5 | 6 | 5.5 | 5 | 4.5 | 4 | 3.5 | 3 | 2.5 | 2 | 1 | 0 |

出處：IELTS 官方〈IELTS scoring in detail〉（ielts.org）只公布幾個錨點（約 16 題＝5、23 題＝6、30 題＝7、35 題＝8），而且每次考試的換算會依難度微調；中間的半級分是常見的練習用換算表。這次沒有連網核對，所以頁面和這份文件都標「估算」。

### 頁面

- **管理員上傳**：`next.config.ts` 的 `serverActions.bodySizeLimit` 和 `experimental.proxyClientMaxBodySize` 都改成 `"20mb"`（錄音 12.8MB）。上傳頁不變。
  - 缺陷紀錄：一開始只改了 `bodySizeLimit`，Marsen 本機上傳 13MB 失敗（「Unexpected end of form」）。原因是請求會先經過 `src/proxy.ts`，Next 16 的 proxy 有自己的上限（預設 10MB，超過的部分被截掉），所以兩層上限要一起改。
- **老師審稿**（`/admin/sets/<id>`）：完整考卷時，題目卷照段落顯示四個 section（填空用原本的畫法；單選列題幹和 A/B/C 選項；配對列選項框和項目），每題的審稿卡多顯示 Section 幾、選項（單選和配對）、正確答案、依據（`note`、逐字稿出處）；每題照舊能判 OK／需修改。「一鍵複製回饋」對單選、配對題附上題幹和選項。
- **學生考試**：同一個考試頁，錄音照現有做法連續播放（`new Audio()`、不給控制鈕、不能暫停），題目卷依段落顯示；單選用 radio、配對用下拉選單（選項字母）、填空沿用輸入框。看題停頓的題號是全卷題號；`s<n>-check` 也算檢查時間。
- **成績頁**：答對題數（滿分 40）、雅思級分（估算）、每個 section 對幾題；每題對錯清單照舊。

### 不做

搬離 Cloud Run、錄音直傳存放空間、手機版、UI 改版、#280 題型、回饋連結、通用題型框架、改舊的考試紀錄、題組列表的「版本」欄改顯示 3.x（列表沒有讀 paper，照舊顯示小版號）。

## 檔案

- domain：`examSet/bundle.ts`（收 2、3）、`examSet/fullExam.ts`（新：判斷完整考卷、段落範圍、各段答對、級分）、`exam/grading.ts`（`letter`）、`exam/paper.ts`（完整考卷的題號）
- application：`examSet/fullExamJson.ts`（新：3.0 外型檢查＋轉換）、`examSet/uploadExamSet.ts`、`exam/paperView.ts`（區塊）、`exam/startExam.ts`、`exam/examResult.ts`、`exam/getAttemptResult.ts`、`examSet/reviewView.ts`
- presentation：`exam/ExamRunner.tsx`、`exam/FullExamPaper.tsx`（新）、`exam/ExamResult.tsx`、`admin/review/*`、`lib/examTiming.ts`、`lib/reviewNotes.ts`
- 其他：`next.config.ts`、`messages/en.json`、`messages/zh-TW.json`

## 任務

- [x] T1：這份 design
- [x] T2：上傳 3.0（外型檢查、轉換、收大版號 3、上限 20MB）；驗證：`uploadExamSet.test.ts` 用真的 `s1-tour-0002` 結構的樣本；2.x 測試不改照過
- [x] T3：老師審稿四段、單選配對的選項／答案／依據、複製回饋；驗證：`reviewView` 測試
- [x] T4：學生考試：分段題目卷、三種題型作答、檢查時間；驗證：`paperView`、`examTiming` 測試，`pnpm build`
- [x] T5：批改 `letter`、成績頁（總分、級分、各段）；驗證：`grading.test.ts`、`fullExam.test.ts`、`examFlow` 測試
- [x] T6：中英文翻譯（兩邊 key 一致，`messages.test.ts`）
