# Design: 考試：完整考卷分段翻頁，錄音只進不退

**來源**：issue #289 的驗收條件 AC-1～10，加上商業主管補的確認條件 AC-11～16（判級 `build`：寫 design、不寫 spec）。直接在 `feat/282-full-exam`（已含 #285、#286、#288）上做。

只改完整考卷（`sheet.fullPaper` 不是 null）；單段舊考卷的考試頁完全不變（AC-15）。

## 決定紀錄

| 要決定 | 選了 | 為什麼 |
| --- | --- | --- |
| 分頁怎麼記 | `ExamRunner` 加 `page: number \| "submit"`（段號或交卷頁），只有完整考卷用 | 和審稿頁 `ReviewTab` 同一種寫法；單段考卷不走這條路 |
| 一頁只畫一段 | `FullExamPaper` 加 `section` prop，照 `FullReviewPaper` 的寫法 `paper.sections.filter((s) => s.ielts === section)` | 最小改動，配對選單、單選、填空的畫法不動（#286） |
| 換頁時答案 | 答案仍放在 `ExamRunner` 的 `answers`／`answersRef`，換頁只換畫哪一段 | 換頁卸載的是題目的 DOM，答案在上一層，不會掉；交卷用 `answersRef.current`（畫面上最新的答案） |
| 換頁時錄音（AC-6） | 錄音和事件留在 `begin()` 的 `new Audio()`／`audioRef`，換頁只 `setPage`；外層 `key="running"` 不跟頁數變 | 錄音物件不在畫面裡、不跟元件掛載走，換頁不會停、重播、跳段 |
| 擋倒退、拖動、跳段（AC-5、AC-12） | 維持 `new Audio()` 不放進畫面、沒有 `controls`，**不加 `seeking` 監聽** | 網頁上沒有進度條、沒有按鈕可以動錄音位置，就沒有途徑倒退或拖動。媒體鍵、作業系統媒體控制不在這張（issue「不在這張」）。驗收時確認考試中 DOM 沒有 `<audio>`；若測試發現網頁上還有途徑能拖動才加監聽 |
| 錄音到下一段時頁面換不換（AC-3） | 不換；`section`（錄音在哪段，`sectionOf`）和 `page`（正在看哪段）分開記 | Marsen 定的：學生自己翻 |
| 兩個段號怎麼不混淆（AC-11） | 寫法不同：「正在看 Section n」對「♪ 錄音在 Section m」；步驟條上錄音那段標 ♪ | 一個是位置、一個是聲音，用符號和動詞分開 |
| 步驟條 | 另寫 `exam/ExamSteps.tsx`，長相照 `admin/review/StepBar.tsx`（電腦一排、手機 `details` 收一行、♪ 標錄音在哪段），每步寫「剩 n 題沒填」或 ✓，最後一步「交卷」 | 審稿頁的 StepBar 綁了審稿的狀態和 `review.flow.*` 翻譯，不改它（AC-16）。同樣子出現第二次，先標註，第三次再抽共用（憲章 DRY：重複兩次先標記） |
| 各段未填怎麼算 | `examDraft.ts` 加 `sectionQuestionIds(fullPaper)`（每段的題目代號）和 `unansweredBySection(fullPaper, answers)`；`questionIdsOf` 改成攤平 `sectionQuestionIds` | 步驟條、交卷頁、確認區塊都用同一個函式，題數一定一致（AC-14） |
| 交卷按鈕位置（AC-7） | 完整考卷：只在交卷頁；考卷底下不放。單段考卷照舊（考卷底下、`window.confirm`） | AC-7、AC-15 |
| 交卷前再確認（AC-8） | 交卷頁按「交卷」（次要樣式）→ 頁面上展開確認區塊：再列一次各段未填、可點回去、「再檢查」和「確定交卷」；打開時焦點在「再檢查」，不是「確定交卷」 | 不用 `window.confirm`：要列各段、要能點回去。預設焦點放安全的那顆 |
| 交卷頁「回到 Section n」 | 放在交卷按鈕前面 | 先引導回去檢查 |
| 錄音播完自動交卷 | 照舊不問 | #285 的行為 |
| 交卷中錄音出錯 | 錯誤處理和續播先看 `handingInRef.current`，交卷中不 `play()` | 補漏洞：交卷中錄音出錯重試會在交卷時又播起來 |
| 交卷失敗回到作答 | 答案保留（本來就在）、不重複交卷（`handingInRef` 本來就擋）；完整考卷錄音從原秒數接著播（暫停時位置還在，直接 `play()`；錄音已播完就不播） | 純前端播放控制，不改交卷流程、不改授權。單段考卷照舊（AC-15） |
| 換頁捲動 | 換頁捲回頂端 | 長段落翻到下一段時從題目開頭看 |
| 狀態列、錯誤訊息、步驟條 | 一起放在黏在頂端的區塊 | 翻到哪頁都看得到錄音播到哪 |
| 說明頁 | 完整考卷（`overview.sections > 1`）多一行「錄音開始後只進不退，可以自己前後翻頁」 | 說明頁還沒拿到考卷內容，用頁面算好的段數判斷 |
| 翻譯 | 新增 `exam.paging.*`，兩語言 key 一致；不借 `review.flow.*` | 審稿頁的字以後改了不會影響考試頁 |
| 交卷按鈕的次要樣式 | 用 `Button` 現有的 `variant="secondary"` | 不在 className 寫顏色（CLAUDE.md） |

## 內容

### 純函式（`src/presentation/lib/examDraft.ts`）

- `sectionQuestionIds(fullPaper): { section: number; questionIds: string[] }[]`：每段（`ielts`）的題目代號，照畫面順序
- `unansweredBySection(fullPaper, answers): { section: number; left: number }[]`：每段還有幾題沒填（用 `unansweredCount`，空白算沒填）
- `questionIdsOf(paper, fullPaper)`：完整考卷改成攤平 `sectionQuestionIds`，行為不變
- 單元測試（中文描述）：各段分開算、空白算沒填、加總等於 `unansweredCount(questionIdsOf(...))`

### 考試頁（`ExamRunner.tsx`、`FullExamPaper.tsx`、新增 `ExamSteps.tsx`）

- 完整考卷開考後 `page` 從第一段開始。每頁：黏住的區塊（狀態列、錯誤、步驟條、正在看／錄音在）→ 這一段的題目 → 底下「上一段／下一段」（S1 沒有上一段；S4 的下一頁是「交卷頁」）
- 交卷頁：各段「Section n・剩 k 題沒填」或 ✓，每段一個「回到 Section n」；下面「交卷」（次要樣式）。按了展開確認區塊（AC-8），「確定交卷」才呼叫 `handIn`
- 交卷中（`stage === "submitting"`）：題目鎖住、確認區塊按鈕鎖住、顯示「交卷中…」

## 已知限制（不做，另開工作項）

AC-9「重新整理後回到原本那一頁更好，但答案一定要在」中的這幾件**現況就做不到，這張也不做**：

- 重新整理後救回答案：#285 的 `loadDraft` 寫好了但沒有地方呼叫；重新整理會回到說明頁，按開始是新的作答，並刪掉舊暫存（`clearOtherDrafts`）
- 重新整理後回到原本那一頁
- 重新整理後錄音從暫存的秒數接著播

這不是這張造成的；要做需要「接續同一次作答」的流程（伺服器端作答狀態、錄音位置），另開工作項。

AC-9 這張要保證的是：#285 草稿（每改一題存）、離開提醒、交卷確認，#286 的「Section n・」狀態、試音量、配對題選單不壞；考試中翻頁、換段答案不掉；交卷用畫面上最新的答案。

## 不做

- 媒體鍵、耳機按鈕、作業系統媒體控制能暫停或移動錄音（issue 寫「不在這張」）
- 成績頁、單段舊考卷的考試頁
- 共用 `StepBar`（見決定紀錄）；`admin/` 底下任何檔案都不動
- 不改資料庫、Server Action、權限
