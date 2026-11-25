# Design: 考試和審稿：作答和紀錄不能救不回來

**來源**：issue #285 的驗收條件（判級 `build`：寫 design、不寫 spec）＋主管的決定 D3–D9。接在 `feat/282-full-exam` 後面。

## 內容

### 答案暫存（D3）

- 存在**學生的瀏覽器** `localStorage`，一次作答一個鍵 `exam-draft:<attemptId>`，值是 `{attemptId, setId, answers, savedAt}`。
- 每改一題就存（`ExamRunner.changeAnswer`）。
- 交卷成功、網站回 `already_submitted`、`not_found` 時刪掉。
- **開始新考試**時，清掉所有其他次的 `exam-draft:*`，只留這次的（`clearOtherDrafts`）。沒交卷就離開留下的暫存不會一直累積。
- **考試中按登出**、在離開提醒按「確定離開」時，清掉這次的暫存（共用電腦換人時，不留答案）。登出表單加 `data-logout`，離開提醒認得出來（`isLogoutForm`）。點選單、上一頁、重新整理離開**不清**，留給之後的 AC-3 用。其他頁面的登出不管（那時沒有進行中的考試）。
- 讀寫都包 `try/catch`，連拿 `window.localStorage` 都包：私密瀏覽、空間滿寫不進去，考試照常。
- 純函式在 `src/presentation/lib/examDraft.ts`（`saveDraft`／`loadDraft`／`clearDraft`／`clearOtherDrafts`、`questionIdsOf`、`unansweredCount`），附單元測試；`ExamRunner` 只接上去。
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

**已知限制**：iPhone Safari 不支援 `beforeunload` 提醒，所以 iPhone 上重新整理、關分頁不會問（點選單、上一頁照樣會問）。回來時用暫存答案交卷，見文末「補做 AC-3」。

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

## 補做 AC-3（2026-11-26）

Marsen 決定照 AC-3：考試中重新整理或離開，**不能回來接著考**，回到考試頁就用暫存答案交卷。

- 進考試頁時找這份考卷（setId）沒交卷的暫存（`findDraftForSet`，有好幾份取最新）→ 顯示「上次考試沒交卷，正在用存下的答案交卷…」→ 交卷 → 成績頁 `?left=1` 顯示「你在考試中離開了頁面，已用離開前的答案交卷」
- 網站找不到那次作答（例如換了帳號）→ 刪掉暫存，照常顯示考試說明；網路錯誤 → 暫存留著，下次回來再交
- 一開始考就存一份空的暫存：一題都沒填就重新整理，回來也會交卷（不然那次作答一直掛著沒交）
- 暫存只在瀏覽器，用 `useSyncExternalStore` 讀（伺服器端當作沒有）；只在考試說明頁觸發，開始考試後這次的暫存不會被拿去交
- iPhone Safari 沒有離開提醒：考試中把 `html` 的 `overscroll-behavior` 設成 `none`，擋掉往下拉重新整理的手勢；網址列的重新整理鈕擋不掉，回來就交卷
- 不改：點選單、上一頁、重新整理照舊先提醒；考試中登出（在提醒按「確定離開」）照舊清暫存，不會交卷
