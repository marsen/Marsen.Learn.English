# Design: 考試和審稿：作答和紀錄不能救不回來

**來源**：issue #285 的驗收條件（判級 `build`：寫 design、不寫 spec）＋主管的決定 D3–D9。接在 `feat/282-full-exam` 後面。

## 內容

### 答案暫存（D3）

- 存在**學生的瀏覽器** `localStorage`，一次作答一個鍵 `exam-draft:<attemptId>`，值是 `{attemptId, setId, answers, savedAt}`。
- 每改一題就存（`ExamRunner.changeAnswer`）。
- 交卷成功、網站回 `already_submitted`、`not_found` 時刪掉。
- 讀寫都包 `try/catch`，連拿 `window.localStorage` 都包：私密瀏覽、空間滿寫不進去，考試照常。
- 純函式在 `src/presentation/lib/examDraft.ts`（`saveDraft`／`loadDraft`／`clearDraft`、`questionIdsOf`、`unansweredCount`），附單元測試；`ExamRunner` 只接上去。
- 網站、資料庫不動，沒有 migration。

### 離開提醒（D4，AC-1）

只在 `stage === "running"` 裝上（`src/presentation/lib/leaveGuard.ts` 的 `installLeaveGuard`），回傳 `release()`：

| 怎麼離開 | 攔法 | 提示 |
| --- | --- | --- |
| 重新整理、關分頁、網址列換網址 | `beforeunload` | 瀏覽器自己的對話框，文字不能改 |
| 點左側選單、任何 `a[href]` | `document` capture `click` | `window.confirm`（翻譯檔 `exam.leaveConfirm`） |
| 表單送出（登出） | `document` capture `submit` | 同上 |
| 上一頁 | 開始時 `history.pushState` 一筆，聽 `popstate` | 同上；按取消再推一筆留在原頁，按確定 `history.back()` |

- 開新分頁（`target=_blank`、按 Cmd／Ctrl／Shift／中鍵）、下載、`#` 錨點不攔（`leavesPage`，有測試）。
- 確定離開後設 `leaving`，後面的 `beforeunload` 不再問第二次。
- 交卷跳成績頁（`window.location.assign`）前先 `release()`，自動交卷、確認交卷後不會又跳提醒。元件卸載時也會 `release()`。

**已知限制**：iPhone Safari 不支援 `beforeunload` 提醒，所以 iPhone 上重新整理、關分頁不會問（點選單、上一頁照樣會問）。答案已存在瀏覽器，但這次沒做 AC-3 的「回來自動交卷」，所以重新整理後暫存答案目前不會被用上。

### 交卷確認（D5，AC-2）

- 只有學生自己按「交卷」才 `window.confirm`；錄音播完自動交卷不問。
- 沒填題數＝題目卷上所有作答格（填空、單選、配對）減有填的；只有空白算沒填（畫面上看起來就是空的）。
- 有沒填：「還有 N 題沒填，確定要交卷嗎？」；全填完：「確定要交卷嗎？」。

### AI 審稿意見改「已處理」（D6、D7，AC-4）

- 資料不動：`ai_actions` 存的值維持 `"deleted"`，不搬資料、不寫 migration；`reviewFeedback.ts` 餵給出題工具的文字不改。
- 只改畫面 `NoteCard.tsx` 和翻譯檔：按鈕「標為已處理」(Mark as handled)、標籤「已處理」(Handled)、小標籤「已處理 N」、說明「處理說明：…」；拿掉刪除線和灰字，AI 原文完整顯示；「復原」保留（英文從 "Undo delete" 改 "Undo"）。按鈕從紅色改一般次要按鈕（不是破壞性動作）。
- 改寫的 AI 意見不能空白的錯誤訊息，從「請刪除」改「請標為已處理」。
- 權限不動（D8）：`permission.ts`、`/admin/reviews` 都沒改。

### 手機（AC-5）

用 390px 寬實際走一次：交卷確認、點選單提醒。iPhone Safari 的 `beforeunload` 見上面的限制。

### 不做

- AC-3（提醒後仍離開，回來用暫存答案自動交卷）：D9 排最後，這次不做。暫存答案已經存好，之後做 AC-3 只要在進考卷頁時 `loadDraft` 並交卷。
