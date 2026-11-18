# Design: 審稿：審到一半救得回來，完整考卷一段一段審

**來源**：issue #288 的驗收條件 AC-1～20（判級 `build`：寫 design、不寫 spec）。接在 `feat/282-full-exam`（已含 #285、#286）上直接做。

時限 180 分鐘。順序：design → **救得回來（AC-1/2/3/18，先 commit）** → 分頁主要工作（寫好先不開）→ 最後一個 commit 才把完整考卷切到分頁版 → 有時間再做 AC-6 折疊 → AC-7 → AC-9 → AC-5 手機收合。沒做的寫在最後「不做」。

## 決定紀錄

| 要決定 | 選了 | 為什麼 |
| --- | --- | --- |
| 暫存放哪 | 老師瀏覽器的 localStorage，一份題組一個鍵 `review-draft:<accountId>:<setId>` | 沿用 #285 學生考試頁（`examDraft.ts`）的做法；不改資料庫（AC-17）。鍵帶 accountId：同一台電腦換人登入不會拿到別人的暫存 |
| 暫存什麼時候算過期 | 存的時候記下「上次送出時間」和「上傳時間」，回來時任一個對不上就不套用、刪掉，畫面寫「暫存已過期，已清除」 | 別台電腦已送出、或題組被覆蓋上傳後，舊暫存會蓋掉新的判定；不能靜默丟掉，所以要寫出來 |
| 暫存和線上不一致時讓老師挑 | **不做**，另開工作項 | 這張只要救得回來；過期就清掉並告知 |
| 什麼時候讀暫存 | 掛載後在 useEffect 讀一次，讀完才開始存 | 在 useState 初始值讀會和伺服器畫的不一樣（hydration mismatch） |
| 內容和伺服器資料一樣時 | 刪掉暫存 | 基準每次 render 從 prop 算，送出成功 revalidate 後不會誤判成「有改」 |
| 總評 | 改成受控元件 | React 19 每次 form action 前會 `form.reset()`，非受控的總評在送出失敗時會被清掉 |
| 離開提醒 | 擴充 `installLeaveGuard` 加選填第三參數 `{ shouldAsk, ignoreForm }`；審稿頁第一次有暫存才裝，裝了不拆（到送出成功或卸載），有暫存才問；審稿頁自己的 form 用 `data-review-form` 排除 | 反覆裝拆會一直 pushState。ExamRunner 不傳第三參數，行為不變 |
| 有暫存時按刪除題組 | 會先問「要離開嗎」，確定後刪暫存再刪題組 | 刪題組本來就要離開這頁，多問一次合理。刪除是 Server Action 直接 redirect，瀏覽器拿不到「成功」，所以在確定送出刪除時就清掉；萬一刪除失敗、老師又繼續改，下一次改動會重新存 |
| 「判過」的定義（AC-10） | 判「有問題」就算判過，AI 意見不用處理；判「OK」要這題每則 AI 意見都已處理或改寫才算 | **和 AC-10 字面不同**：判有問題時，回饋會是 NEEDS FIXING + 老師同意 AI，和老師本意一致，硬要標已處理反而會讓回饋變成「AI 說的不是問題」。判 OK 卻保留 AI 意見，出題工具會收到「同意 AI 指出的問題卻判 OK」，所以擋下。Marsen 可推翻 |
| 預設 OK 的題目 | 標「預設 OK，請確認」，老師再按一次 OK 才算看過（記在 seen） | 流程感：每題都要看過才往下（Marsen 的決定）。上次送出的審稿已判完、又沒暫存時，全部當看過 |
| 段落完成怎麼記 | 從判定算：這段每題判過，且「完成時記下的 signature」等於現在這段的判定和 AI 處理的 signature；signature 變了就自動回到進行中（AC-13） | 不新增資料庫欄位（AC-17）；confirmed 存在暫存裡，重新整理後算回來 |
| 完成順序 | 第 n-1 段完成才按得下 Section n 的完成；前一段重開時，後面已完成的不連帶取消 | AC-12「完成照順序」；連帶取消會讓老師重做已確認的段落 |
| 整段 AI 意見（`ieltsSection=n` 且不屬於某題） | 放該段小結，可處理，不算進段落完成 | 不屬於某一題，判定掛在整套；總結頁列出還沒處理的提醒，不擋送出 |
| 整套判定、整套 AI 意見 | 放總結頁 | 整套的判定本來就要判；四段都完成、整套也判了才能送出 |
| 錄音 | `<audio>` 留在黏住的錄音列，不放進分頁內容 | 切分頁不卸載，錄音不跳（AC-15）；步驟條比對播放秒數和各段 `sN-intro` 標「正在播」 |
| 不改的 | 回饋文字（`reviewFeedback.ts`）、資料庫、Server Action、權限 | 不在範圍；不涉及認證、授權、金流、資安 |

## 內容

### 暫存（AC-1、AC-3、AC-17、AC-18）

- `src/presentation/lib/reviewDraft.ts`（照 `examDraft.ts`，讀寫都包 try/catch）：
  - `ReviewDraft = { setId, accountId, baseReviewedAt, uploadedAt, verdicts, aiActions, notes, comment, confirmed, seen, savedAt }`
  - `saveReviewDraft`、`loadReviewDraft`（形狀不對回 null）、`clearReviewDraft`、`checkReviewDraft(draft, base)`：回 `ok`／`stale`，套用前濾掉不認得的題號、AI 意見 ref
- 頁面多傳 `accountId`。ReviewForm 掛載後讀一次（`loaded` 旗標），讀到 → 套用；過期 → 刪、顯示一行提示。
- 之後每次內容改變：等於基準就刪，不等於就存。
- 存：判定、AI 意見處理、老師意見、總評、段落確認、seen。**正在打還沒按「好」的意見框不存**（還沒成為意見）。
- 送出成功（`state.saved`）：刪暫存、拆離開提醒。之後若送出成功要換頁，也要先拆提醒。送出失敗（`state.problems`）：什麼都不動。
- 畫面固定一行：「判定暫存在這台瀏覽器，送出後才算正式」。
- 2.x 單段考卷一樣有暫存和離開提醒（AC-18），畫面其他部分照舊。

### 離開提醒（AC-2）

- `installLeaveGuard(message, onLogoutConfirmed?, options?)`，`options = { shouldAsk?: () => boolean; ignoreForm?: (f) => boolean }`：
  - beforeunload、連結 click、表單 submit、上一頁都先看 `shouldAsk()`；false 就不問、直接放行（上一頁也照常回去）。
  - `ignoreForm(form)` 為 true 的 submit 不問（審稿頁自己的送出）。
- 已知限制（沿用 #285）：iPhone Safari 不支援 beforeunload，重新整理、關分頁不會問；暫存仍在，回來救得回來。

### 「判過」和段落完成（AC-10～13、17；只有完整考卷）

- `src/presentation/lib/reviewSections.ts`（純函式，單元測試）：`sectionOfQuestion`、`isJudged`、`missingOf`（逐題缺什麼）、`sectionProgress`、`signature`、`sectionStatus`、`nextPending`（跨分頁）、`sectionStart(events, n)`。
- 判 OK 但還有 AI 意見沒處理：這題不收起，卡上寫「還有 N 則 AI 意見要標為已處理」。判有問題就收起換下一題（AC-9）。
- 完成鈕按不下去時逐題列出缺什麼（「第 3 題：還沒判」「第 5 題：AI 意見 1 則未處理」「第 7 題：預設 OK，請確認」），點了跳到那題。

### 分頁畫面（AC-4、5、6、7、8、14、15、16）

- ReviewForm 仍是狀態擁有者，不大重構。新增：
  - `review/StepBar.tsx`：S1～S4、總結；狀態 ✓／剩 N 項／還沒開始；正在播哪段。手機用 `<details>` 收成一行，點開看全部（AC-5）
  - `review/SectionSummary.tsx`：可折疊小結：OK／有問題／待處理數、整段 AI 意見、▶ 從 Section n 開頭播（AC-6、7）
  - `review/SectionFooter.tsx`：完成鈕、還沒判的項目（AC-11）
  - `review/ReviewSummaryTab.tsx`：四段進度、整套判定與整套 AI 意見、總評、合格／不合格、送出（AC-16）
- `FullReviewPaper` 加 `section` prop 只畫那段；批註卡、逐字稿依分頁過濾（AC-8）。
- `reviewView.ts` 的 `AiNote` 加 `ieltsSection`（findings／warnings 的 `ielts_section`），補 application 測試。
- AC-14：下一個待處理在別段時，先切分頁再展開。
- 錄音列的送出拿掉，送出只在總結頁（AC-16）。**完整考卷改走分頁版、錄音列送出換成總結頁送出，放在同一個最後的 commit**；做不完就不打開，不上線半套。

### 不能壞（AC-20）

- #285：離開提醒、交卷確認、考試草稿、標為已處理。#286：進度、下一個待處理、時間編號跳轉。
- 分層：presentation 不 import app 或 infrastructure（eslint boundaries）。新文字兩種語言 key 一致。

## 手動測試劇本

### AC-21 救得回來（電腦，2.x 和完整考卷各一次）

1. 打開一份還沒審完的題組，判兩題、標一則 AI 意見已處理、寫總評
2. 重新整理 → 先跳瀏覽器提醒，選「留下」還在原頁；再重新整理選「離開」→ 回來後判定、已處理、總評都在
3. 點左側選單 → 跳提醒，按取消留在原頁；按上一頁 → 跳提醒
4. 關分頁再開 → 都還在
5. 不要真的送出（會改 Marsen 的資料）。送出失敗：DevTools 把網路設成 Offline 再按送出 → 錯誤訊息出來，總評、判定都在，重新整理後也在

### AC-22 分頁流程（完整考卷）

1. 上方步驟條 S1～S4、總結；目前在 S1，只看到 S1 的題目、意見、逐字稿
2. 小結寫出 OK／有問題／待處理數；按「▶ 從 Section 2 開頭播」錄音跳到 S2 開頭
3. 判 OK 一題 → 自動收起，下一題展開；判 OK 但還有 AI 意見沒處理 → 不收起、寫出還要處理幾則
4. 還有沒判的題就按不下「這段完成」，列出缺什麼，點了跳到那題
5. 先去 S3 判幾題可以，但 S3 的完成鈕要等 S2 完成
6. 回 S1 改一題判定 → S1 變回進行中，要再按一次完成
7. 錄音播到 S2 時，分頁不換，步驟條標「正在播 S2」；切分頁錄音不停
8. 下一個待處理在別段 → 自動切分頁再展開
9. 總結頁：四段進度、整套判定、總評、合格／不合格；四段都完成、整套判了才按得下送出；錄音列沒有送出

### AC-23 不能壞、窄螢幕

1. 390px 寬：步驟條收成一行，點開看全部；整頁不橫捲
2. 學生考試頁：作答中重新整理有提醒、答案在；交卷確認照舊
3. 2.x 單段考卷審稿頁：畫面照舊（錄音列有送出），多了暫存和離開提醒

## 不做

（實作完依實際情況補）
