# Design: 刪除任何題組（單筆、批次），保留作答紀錄

**來源**：[story-20261109-01](../stories/story-20261109-01.md)

## 內容

### 1. 資料庫：拿掉作答紀錄對題組的外鍵

- `schema.ts` 的 `examAttempts.setId` 拿掉 `.references(() => examSets.setId)`；照 `examReviewLog` 的寫法加註解（不設外鍵，題組刪掉後紀錄還在）
- `pnpm db:generate` 產生 migration：`DROP CONSTRAINT exam_attempts_set_id_exam_sets_set_id_fk`
- 只拿掉限制，舊版程式照樣能跑（符合「migration 要讓舊版還能用」）

作答紀錄本身已存 `score`、`total`、`results`（每題作答、正解、可接受答案、對錯），成績頁不靠題組也能顯示。現有程式找不到題組時已經有退路：

| 地方 | 找不到題組時 |
| --- | --- |
| `GetAttemptResult` | 標題用 setId |
| `ListMyAttempts` | 標題用 setId |
| `GetStudentDashboard` | 標題 null（畫面已處理） |

### 2. Domain

- 刪掉 `domain/examSet/discard.ts`（「只有退回、沒人寫過才能刪」的規則不要了）和它的測試

### 3. Application

`DeleteExamSet` 改成 `DeleteExamSets`（一次刪多套，單筆就是只傳一個）：

```ts
execute(input: { actor: Account; setIds: string[] }):
  Promise<{ ok: true; deleted: number } | { ok: false; problem: string }>
```

- 權限沿用 `uploadSets`（只有管理員有）
- 不存在的 setId 略過；每套刪題組、再刪錄音
- 一套一套刪：管理員一次頂多十幾套，不需要批次 SQL

確認視窗要顯示「幾套有人寫過」：

- `AttemptRepository` 加 `countBySets(setIds: string[]): Promise<Record<string, number>>`
- 管理員看題組清單、題組頁時由頁面查好，用 props 傳給元件

### 4. 畫面

- **題組頁 `/admin/sets/[setId]`**：管理員才看得到 `DeleteSetButton`（沿用總覽的元件），確認文字帶入寫過的人數；刪完導到 `/admin/sets`
- **題組清單 `/admin/sets`**：管理員才有勾選框欄位和全選；表格上方「刪除選取的 N 套」按鈕，`window.confirm` 寫出「刪除 N 套，其中 M 套有人寫過，刪了不能復原」
  - 每一行的「開放對象」已經是一個 form，form 不能巢狀，所以勾選框用 `form="delete-sets"` 掛到表格外的刪除 form
- **管理員總覽**：退回題組旁的刪除按鈕照舊
- Server Action：`deleteExamSetsAction(formData)` 讀所有 `setId`，刪完 `revalidatePath` 總覽、清單並 `redirect("/admin/sets")`
- 文字放翻譯檔（`sets.*`、`adminDashboard.*`），中英都要

### 不做的事

- 不做封存、不做復原
- 作答紀錄不另存題組標題（顯示 setId 就夠）

### 測試

- application：任何狀態、有人寫過都刪得掉；作答紀錄還在、成績照樣拿得到；非管理員擋下；刪公開題組後免費試卷是 null
- `pnpm lint`、`pnpm test`、`pnpm build`

## 待釐清

- [ ] 無
