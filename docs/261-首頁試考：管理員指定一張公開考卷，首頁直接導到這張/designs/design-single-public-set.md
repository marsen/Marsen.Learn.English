# Design: 全站唯一的公開考卷，首頁直接導過去

**來源**：

- [story-20261109-01](../stories/story-20261109-01.md)（管理員指定公開考卷）
- [story-20261109-02](../stories/story-20261109-02.md)（路人從首頁進公開考卷）

## 內容

### 1. Domain：公開考卷不看審稿狀態

`src/domain/examSet/access.ts` 的 `canTake` 改成：

```ts
if (!can(roles, "takeExam")) return false;
if (set.access === "unlisted") return false;
if (set.access === "public") return true;          // 管理員說了算，不看審稿
return set.status === "approved" && roles.length > 0; // 會員考卷規則不變
```

`canTake` 已經被這些地方共用，改一處全部跟著變，不用另外改：

| 呼叫的地方 | 結果 |
| --- | --- |
| `ListAvailableExams`（`/exam` 清單、`/exam/[setId]` 是否顯示開始） | 待審的公開考卷出現在清單裡，可以開始寫 |
| `StartExam` | 可以開始寫 |
| `GetExamSetAudio` | 拿得到錄音 |
| `StudentDashboard` | 學生總覽也列出公開考卷 |

測試：`access.test.ts` 的「待審稿或不合格的考卷都不能寫」改成只適用於會員考卷，另外加「公開考卷不論審稿狀態都能寫」。

### 2. Port：設公開時，同一個交易把其他公開的改成上架

`ExamSetRepository` 改兩處：

```ts
/** 設定開放對象；設成 public 時，原本 public 的全部改成 members（同一個交易） */
setAccess(setId: string, access: ExamAccess): Promise<void>;
/** 目前公開的那張（理論上最多一張；資料裡若有多張，取最新上傳的） */
findPublic(): Promise<ExamSet | null>;
```

- Drizzle 版：`access === "public"` 時用 `db.batch([...])`（Neon 上同一個交易，跟 `saveReview` 一樣），先 `update ... set access='members' where access='public' and set_id <> :id`，再把這張設成 public
- 記憶體版照同樣規則改，給測試用

「一張」的規則放在 repository 的交易裡，而不是 use case 先查再改：兩個管理員同時操作也不會變成兩張公開。

**不加資料庫的 unique 限制**：

- 正式資料庫現在可能已經有多張 public。加了限制，migration 就要先處理掉這些資料
- 舊版程式在部署過程中按公開會直接出錯，違反「migration 要讓舊版還能用」
- 管理員只有一兩位，交易就夠了。資料裡若還留著多張，管理員下次按公開就會清掉；在那之前，`findPublic` 取最新上傳的那張

### 3. Application

- `SetExamAccess`：邏輯不變（權限、格式、存在檢查），把註解改成新規則
- 新增 `application/exam/getTrialExam.ts`：

  ```ts
  /** 首頁試考的考卷：目前公開的那張，沒有就是 null */
  class GetTrialExam { execute(): Promise<{ setId: string } | null> }
  ```

  首頁只需要 setId，不回傳整張題組
- DI：`infrastructure/di/examSetContainer.ts` 加 `getTrialExam()`

### 4. 首頁

`src/app/page.tsx`：

```ts
const trial = await getTrialExam().execute();
<LandingPage examHref={trial ? `/exam/${trial.setId}` : "/exam"} ... />
```

`LandingNav`、`LandingPage` 主視覺、`DemoQuestion` 都已經用 `examHref`，presentation 不用改。

首頁本來就讀登入 cookie（`getCurrentAccount`），每次請求都會重新產生，所以管理員換了公開考卷，首頁**立即**跟著變，不需要另外處理快取。

### 5. 後台 `/admin/sets`

- 頁首加一行「首頁試考：`s1-xxx`」（連到該題組），沒有時顯示「目前沒有公開題組，首頁會導到考卷清單」
- `ExamSetTable` 多收一個 `publicSetId?: string`：按其他題組的「公開」時，用 `window.confirm` 提示「會取代目前公開的 s1-xxx（改成上架）」，取消就不送出。沒有公開題組時不提示
- 翻譯檔 `examSet.accessHint.public` 改成「公開：首頁試考用，全站只有一張，誰都能寫，不用等審稿」；新增的文字放 `sets.*`，`en.json`、`zh-TW.json` 兩份都要補

### 不做的事

- 不加新的開放對象種類，也不加「首頁試考」欄位：「公開」本身就是首頁試考
- 會員考卷的審稿規則不動
- 不做 migration

### 測試

- domain：`canTake` 新規則
- application：`SetExamAccess` 設 B 為公開後，A 變成上架、B 是公開；`GetTrialExam` 有／沒有公開考卷
- `pnpm lint`、`pnpm test`、`pnpm build`

## 待釐清

- [ ] 無
