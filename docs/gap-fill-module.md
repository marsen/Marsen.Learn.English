# 填空模組（gap-fill）規格 v0.5

範圍：Section 1 的表格填空，10 題。單選、複選、配對、地圖題不在這份文件內。

本文件的規則：已定案的寫明；還沒決定的寫 `<<TBD>>`，不先假設答案。

---

# 第一部　總覽

## 1.1 這個模組要做什麼

自動產生雅思 Section 1 風格的聽力題（填表題）：程式抽出題目結構，AI 填入內容並寫出對話逐字稿，程式驗證，最後轉成語音，讓使用者在網頁上作答、評分，並知道自己常錯哪一種題型。

## 1.2 里程碑與目前狀態

| 里程碑 | 做什麼 | 輸入 | 輸出 | 狀態 | 驗收條件 |
|---|---|---|---|---|---|
| M1 | 從固定主題抽出 10 題骨架 | 主題檔、配方檔、考試設定、種子 | 骨架、題目卷、預覽頁 | 已完成 | 8 項測試全過（見第二部） |
| M2 | 從骨架產生逐字稿並驗證 | 骨架 | 答案清單、逐字稿、盲答結果、題組紀錄 | 程式已完成；人工審稿未完成 | 你親自讀過逐字稿；改上游檔案時 status 能指出哪一步過期 |
| M3 | 測驗頁與批改 | 題目卷、逐字稿、答案清單 | 批改結果（對錯與正解） | 頁面已做出；驗收未做 | 你在瀏覽器完整做完一份，結果頁正確 |
| M4 | 語音與時間軸 | 審過的逐字稿 | 音檔、時間軸 | 未開始 | 你戴耳機聽，聽得懂、拼字念清楚 |
| M5 | 帳號與權限 | — | — | 未開始 | `<<TBD>>` |

M3 與 M4 彼此不依賴，各自只依賴 M2，順序可以對調。

## 1.3 整體流程

1. 抽籤（程式）：產生骨架。
2. 填值（AI）：產生答案清單。
3. 組題目卷（程式）。
4. 寫逐字稿（AI）。
5. 驗證（程式）：不通過就帶原因重寫，最多 2 次。
6. 盲答（另一個 AI）：只當警示。
7. 人工審稿（你）。
8. 語音（M4）。
9. 測驗頁與評分（M3）。

第 1 到 7 步是 M1、M2；第 8 步是 M4；第 9 步是 M3。

## 1.4 待決事項

| # | 事項 | 目前狀態 |
|---|---|---|
| A | 帳號與付費（M5）的開工時間 | `<<TBD>>` |
| B | 是否重新拆成「生成、品質保證、交付」三條管線 | `<<TBD>>` |
| C | 同主題 N 天內不重複的規則 | 目前設定為關閉（0 天）；是否開啟 `<<TBD>>` |
| D | 時間軸要不要做到句子層級 | 目前只做每一輪；句子層級 `<<TBD>>` |
| E | 「你常錯哪一種」的呈現方式 | 目前：累積至少 5 題才下結論；是否調整 `<<TBD>>` |
| F | TTS 要不要做抽象層 | `<<TBD>>` |
| G | 姓名、日期、電話等具體的值由 AI 生還是由程式抽 | 目前由 AI 生；是否改變 `<<TBD>>` |
| H | 部分答案算不算對（例如 `Wrenfield` 對 `Wrenfield Road`） | 目前一律算錯；是否放寬 `<<TBD>>` |
| I | 讀完現有 4 套逐字稿並審核 | 待你執行 |
| J | 擴充陷阱手法 | `<<TBD>>` |
| K | 舊題組 s1-library-0001、0002 的處理 | `<<TBD>>` |
| L | 建立 git remote 以便 push | `<<TBD>>` |
| M | TTS 服務商選哪一家 | `<<TBD>>` |
| N | 結果頁要顯示哪些內容（各題型與陷阱的答對率、答案在哪一句、重聽、弱點提示、累計紀錄） | `<<TBD>>`，M4 時討論；M3 只做批改對錯與正解 |
| O | 語音品質 | 瀏覽器內建語音聽感不佳；留到 M4 處理 |

## 1.5 文件對照

- 規格（本文件）：repo 的 `docs/gap-fill-module.md`
- 人工操作步驟：repo 的 `docs/manual-flow.md`
- 欄位與格式的詳細說明：本文件的附錄

---

# 第二部　M1：從固定主題抽出骨架

## 2.1 目標

給定主題、情境變體和陷阱配方，程式抽出 10 題的結構（骨架）。骨架只有結構，沒有任何答案。純程式，不使用 AI。

## 2.2 輸入

| 輸入 | 位置 | 說明 |
|---|---|---|
| 考試設定 | `config/exam-profile.json` | 題數、字數、間距等，見附錄 C |
| 主題檔 | `content/topics/<主題>.json` | 手寫，一個主題一個檔，見附錄 D |
| 陷阱配方 | `content/recipes/section1.json` | 手寫，3 種配方，見附錄 E |
| 種子 | 指令參數 | 同一個種子加同樣的輸入檔，產生同樣的骨架 |

## 2.3 目前的主題

| 主題 id | 名稱 | 情境變體 | 每個變體的欄位數 |
|---|---|---|---|
| library-card | 圖書館辦證 | student、resident | 20 |
| gym-membership | 健身房入會 | student、employee | 20 |
| car-rental | 租車 | tourist、business | 20 |

## 2.4 抽籤流程

1. 抽一個主題。
2. 抽一個情境變體。有些欄位只在特定變體出現。
3. 抽一個陷阱配方（各種陷阱各幾題，加起來剛好 10）。不抽上一份用過的配方。
4. 從這個主題、這個變體的欄位池抽出 10 個欄位。成組的欄位（例如門牌與街名）一起抽或一起不抽。
5. 依每個欄位允許的陷阱，把配方的陷阱配上去，每個欄位一個陷阱。
6. 題號照表格由上到下排。沒抽到的欄位，整列從表格拿掉。

第 4、5 步的做法：用種子隨機挑一組欄位，檢查配方能不能完整配上；配不上就換一組，最多 300 次。仍然失敗就換下一個配方；全部失敗，回報 `NO_ELIGIBLE_CANDIDATE`，不無限重抽。

## 2.5 規則

- 欄位能用哪些陷阱，由主題檔決定，不讓 AI 判斷。例如日期不套拼字，電話不套同義改寫。
- 日期欄位（`date_of_birth`）不允許「相近數字」陷阱，只用「先講錯再更正」或不加陷阱。原因：日子只有 13 對 30 說得通，其他組合會讓逐字稿出現不可能的日期。
- 主題檔的結構規則：每個變體可用欄位至少 18 個；表格列的欄位集合要等於欄位池的集合；至少 2 個變體。

## 2.6 輸出

| 檔案 | 說明 |
|---|---|
| `skeleton.json` | 10 題骨架，見附錄 G |
| `paper.json` | 題目卷（空白），見附錄 J |
| `meta.json` | 題組紀錄，見附錄 M |
| `preview.html` | 給人看的預覽頁（不進版控） |

## 2.7 指令

`node generator/cli.mjs draw --seed 123 --out <資料夾>`，可加 `--topic`、`--variant`、`--previous-recipe`。

## 2.8 驗收（8 項，已全過）

1. 缺欄位、重複題號、答案數量不一致都能正確拒絕。
2. 答案只在 `evidence`、不在逐字稿時必須失敗。
3. 大小寫、標點、日期、數字的答案比對各有測試。
4. 自我更正、拼字、相近數字驗證實際語境，不只檢查字串存在。
5. 合法題目不會因為答案字面重疊或固定內容而被拒絕。
6. 離線驗證與正式評分結果一致。
7. 同一輸入與版本可重現；修改輸入後能辨識舊產物已過期。
8. 抽籤：同一種子可重現、不同種子有差異、排不出來時回報錯誤、成組欄位不被拆開、每個陷阱都是該欄位允許的。

---

# 第三部　M2：從骨架到逐字稿

## 3.1 目標

把骨架變成一份完整的題組：答案清單、逐字稿、題目卷，並通過驗證與盲答。AI 負責填內容與寫對話，程式負責所有結構與檢查。

## 3.2 輸入與輸出

| 階段 | 做的人 | 輸入 | 輸出 |
|---|---|---|---|
| 填值 | AI（plan prompt） | `skeleton.json` | `plan.json`（答案清單，附錄 H） |
| 題目卷 | 程式 | `plan.json` | `paper.json`（附錄 J） |
| 逐字稿 | AI（script prompt） | `plan.json` | `script.json`（附錄 I） |
| 驗證 | 程式 | plan、script、paper | 驗證結果（附錄 K） |
| 盲答 | 另一個 AI（blind prompt） | script 的對話與 paper，不給答案 | `check.json`（附錄 L） |
| 人工審稿 | 你 | 逐字稿、預覽頁、盲答警示 | 通過或退回 |

AI 的步驟目前用「人工模式」：程式印出 prompt，由人（或 Claude Code）交給 AI，把 AI 回覆的 JSON 存檔，再用 `assemble` 合併。操作步驟見 `docs/manual-flow.md`。接 API 的方式 `<<TBD>>`。

## 3.3 AI 的規則

**填值（plan）：**
- 所有人名、地址、電話都虛構。電話用英國保留給戲劇的號段（07700 900000 到 900999），email 用 example.com。
- 欄位、陷阱、比對規則、題號一律照骨架抄，不得更動。
- `self_correction` 與 `distractor` 要填 `wrong_value`。
- 答案要符合字數上限；拼字題限定在名字與街名。

**逐字稿（script）：**
- 以答案清單為唯一依據，不得更動答案。
- 長度約 650 到 800 個英文單字（品質指標，不是硬門檻）。
- 第 1 題前至少 3 輪不含答案；題與題之間至少隔 25 個單字。
- 口語要自然，有停頓與重複，但不影響聽懂。
- 逐字母拼字寫成 `H-A-R-G-R-E-A-V-E-S`。
- 規則 8：答案必須唯一合理。答案若是「修飾詞＋名詞」，對話要有對比，讓單獨的名詞不成立。
- 規則 9：易混淆數字要以數字或原字出現在答案前後兩輪內。
- 規則 10：干擾值要以原字說出，出現在答案前後兩輪內，並被明確否定。
- 規則 11：聽錯必須合理，只能聽錯對方真的說過的數字，且錯的數字要是合理值。

## 3.4 驗證與重寫

- 驗證規則 V1 到 V13，全部由程式執行，見附錄 K。分「擋」與「警示」兩級。
- 驗證不通過：把失敗原因帶回去重寫，最多 2 次，超過就停下來（要用 `--force` 才能繼續）。
- 每次重寫後，整份逐字稿重新驗證。
- 盲答只是警示，不能取代人工審稿。

## 3.5 盲答

盲答用另一個全新的 AI，只給逐字稿的對話與題目卷，不給答案。比對規則：

| 規則 | 條件 |
|---|---|
| B1 | 盲答與標準答案不符，或沒有回答 |
| B2 | 列出備選答案，且備選不是「寫法不同但比對規則判對」的變體 |
| B3 | 信心為 low |

每個被警示的題目，你的判定與原因要記錄進 `meta.json`：`<<TBD>>`（尚未實作，目前只記警示數量）。

## 3.6 指紋鏈與狀態

每套題的 `meta.json` 記錄每個階段的檔案指紋、依據的上游指紋、所用 prompt 的指紋、模型與時間。

- 上游檔案被改、或 prompt 改了，該階段與其下游就標為「過期」。
- 狀態依序：drawn → planned → scripted → papered → validated → blind_passed → reviewed。盲答有警示時停在 validated。
- 人工改了 plan 或 script，用 `accept --note "改了什麼"` 重新認可，留下修改紀錄。
- `review --by 姓名` 是人工放行，要求驗證與盲答都是最新。
- 舊題組用 `stamp` 補登記；prompt 指紋記為未記錄，不算過期。

## 3.7 指令

| 指令 | 做什麼 |
|---|---|
| `prompt plan／script／blind <資料夾>` | 組出給 AI 的 prompt |
| `assemble plan／script／check <資料夾> <json>` | 合併 AI 回覆，補上程式決定的欄位 |
| `paper`、`validate`、`blind`、`preview <資料夾>` | 產生題目卷、驗證、盲答比對、預覽頁 |
| `status <資料夾>` | 顯示每階段狀態與能否重寫 |
| `accept`、`review`、`stamp` | 手改後認可、人工放行、補登舊題組 |

## 3.8 目前產出

已產出 6 套真實 AI 題組：s1-library-0003、0004、s1-gym-0001、s1-car-0001 通過驗證，各有 2 到 3 個盲答警示；s1-library-0001、0002 因主題檔改動而過期（處理方式見 1.4 的 K）。

## 3.9 驗收

- 程式部分：已完成。
- 人工部分：你親自讀過逐字稿。**未完成**，見 1.4 的 I。

---

# 第四部　M3：測驗頁與批改

## 4.1 目標

使用者在瀏覽器完成一份題組：看題、聽錄音、作答、批改。答題卷的樣式照雅思：行內填空、編號圓圈、底線欄位。結果頁只做批改對錯與顯示正解，其餘內容 `<<TBD>>`。

## 4.2 輸入與輸出

| | 內容 |
|---|---|
| 輸入 | 題組的 `paper.json`、`script.json`、`plan.json`；`config/exam-profile.json` 的看題與檢查秒數；使用者填的答案 |
| 輸出 | 結果頁：總分，以及每題的對錯、你寫的、正解。不產生檔案，不送伺服器，不留紀錄 |

## 4.3 流程

1. 說明頁：選題組、按開始。
2. 預覽：顯示答題卷並倒數 30 秒，這時不能填。
3. 播放：錄音只播一次，沒有暫停與倒轉；播放中可以填。
4. 檢查：播完後倒數 30 秒，結束自動送出；也可以隨時按送出。
5. 結果頁：總分；每題顯示對錯、你寫的、正解。

## 4.4 答題卷樣式

- 標題置中粗體，說明斜體，說明裡的全大寫片語（例如 NO MORE THAN TWO WORDS AND/OR A NUMBER）加粗。
- 每一列是「標籤：文字 ①＿＿＿」，空格是行內底線欄位，前面有編號圓圈。
- 固定印好的列只顯示文字，不是空格。
- 目前沒有分區標題（例如「I. Client Details」）：`<<TBD>>`。
- 目前每個空格都在標籤之後，不會出現在句子中間：`<<TBD>>`。

## 4.5 規則

- 批改與驗證使用同一套比對函式。
- 語音：目前使用瀏覽器內建語音，只用來測流程；聽感留到 M4。
- 標準答案目前放在前端，只適合測試版。

## 4.6 檔案位置

`exam/index.html`、`exam/app.js`、`exam/core.mjs`、`exam/exam.css`、`exam/sets.json`（可選題組清單，手寫）。開啟方式：`npm run dev`，網址 `http://localhost:5173/exam/index.html`。

## 4.7 狀態與驗收

- 頁面與測試已完成。
- 驗收：你在瀏覽器完整做完一份，批改正確。**未完成。**
- 與 M4 的接口：有 `audio/full.mp3` 的題組播檔案，沒有就用瀏覽器語音。**尚未實作**，`<<TBD>>`。

---

# 第五部　M4：語音與時間軸

## 5.1 目標

把審過的逐字稿合成為音檔，並記錄每一輪在音檔中的起訖秒數。

## 5.2 輸入與輸出

| | 內容 |
|---|---|
| 輸入 | 驗證通過且人工審過的 `script.json` |
| 輸出 | `audio/full.mp3`、`audio/timing.json`（附錄 O） |

## 5.3 流程

1. 每一輪單獨合成語音。
2. 輪與輪之間插入 0.4 到 0.8 秒靜音。
3. 串成 `full.mp3`，並寫 `timing.json`。

## 5.4 規則

- 時間必須來自最終合成的音檔，不能用文字長度估算；音檔重生就要重算。
- 第一版只記錄每一輪（turn 層級）。
- 介面只有一個函式：`synthesize({ text, voiceId, accent })`，回傳音檔位元組與長度。

## 5.5 未決定

- TTS 服務商：`<<TBD>>`
- 費用：`<<TBD>>`
- 口音：目前第一份用英式；其他 `<<TBD>>`
- 結果頁的內容：`<<TBD>>`（見 1.4 的 N）
- 逐字母拼字念法不合格時的處理：規格預想「逗號分隔或 SSML 拼讀標記」，但需實際測試，`<<TBD>>`
- 開工前是否先做樣本測試：`<<TBD>>`

## 5.6 驗收

你戴耳機聽，聽得懂、拼字念清楚。

---

# 第六部　M5：帳號與權限

## 6.1 目標

登入、記錄作答、控制誰能做哪些題組。

## 6.2 已定案的做法

- 用現成服務處理登入，不自己做。具體服務 `<<TBD>>`。
- 兩張資料表：`attempts`（使用者、題組、答案、分數、時間）、`entitlements`（使用者可做哪些題組）。
- 免費試用一次，其餘用 `entitlements` 控制。
- 付費題組的內容不能放在公開網址，要登入且有權限才提供。

## 6.3 未決定

- 開工時間與條件：`<<TBD>>`（見 1.4 的 A）
- 評分是否搬到伺服器：`<<TBD>>`
- 價格與方案：`<<TBD>>`
- 驗收條件：`<<TBD>>`

---

# 附錄　詳細格式與欄位說明

## 附錄 A　資料夾與檔案總覽

```
config/exam-profile.json            考試設定
content/topics/<主題>.json          主題檔
content/recipes/section1.json       陷阱配方
content/sets/<set-id>/
  skeleton.json  plan.json  script.json  paper.json  check.json  meta.json
  preview.html（不進版控）
  audio/full.mp3  audio/timing.json  （M4）
generator/                          程式
exam/                               測驗頁（M3）
tests/                              測試與固定測資
docs/                               文件
```

generator 內的檔案：`cli.mjs`（指令）、`draw.mjs`（抽籤）、`paper.mjs`、`validate.mjs`、`normalize.mjs` 與 `answer.mjs`（比對）、`grade.mjs`（評分）、`artifact.mjs`、`meta.mjs`、`prompt.mjs`、`assemble.mjs`、`blind.mjs`、`preview.mjs`；`prompts/` 內有 plan、script、blind 三個樣板。

## 附錄 B　共用命名與列舉值

| 名稱 | 值 | 說明 |
|---|---|---|
| question_id | q01 到 q10 | 順序等於答案在音檔中出現的先後，也等於表格由上到下 |
| field_id | 小寫加底線，例如 house_number | 主題、骨架、答案清單、題目卷用它對應同一格 |
| turn id | t1、t2… | 逐字稿的輪次 |
| set_id | 例如 s1-library-0001 | 題組識別 |
| trap（陷阱） | self_correction、spelling、similar_numbers、paraphrase、distractor、none | 先講錯再更正、容易拼錯、容易聽混的數字、同義改寫、干擾選項、無陷阱 |
| answer_policy | exact_word、date_equivalence、digits_only、number_word | 比對規則，見附錄 F |
| type（欄位類型） | name_spelled、number、date、phone、place、word；規劃中：time、price | 答案的性質 |
| source（設定來源） | idp、third_party、product | IDP 官方頁、第三方描述、自訂 |
| level（驗證等級） | block（擋）、warn（警示） | 擋＝失敗就停止 |

## 附錄 C　考試設定 config/exam-profile.json

每個值為 `{ value, source, note? }`，除 fiction 外。

| 節點 | 現值 | 說明 |
|---|---|---|
| section | 1 | Section 編號 |
| question_count | 10 | 每份題數 |
| play_once | true | 錄音只播一次 |
| preview_seconds | 30 | 看題時間 |
| check_seconds | 30 | 檢查時間（電腦版全卷結束後另有 2 分鐘） |
| target_words | [650, 800] | 逐字稿目標字數 |
| length_tolerance | 0.15 | 字數容許誤差，超過只出警示 |
| min_gap_words | 25 | 相鄰兩題證據之間至少隔幾個字 |
| min_warmup_turns | 3 | 第 1 題前至少幾輪暖身 |
| topic_cooldown_days | 0 | 同主題 N 天內不重複；0＝關閉 |
| max_draw_attempts | 300 | 抽欄位最多重試次數 |
| fiction.phone_prefix | 07700900 | 只允許的虛構電話開頭 |
| fiction.email_domain | example.com | 只允許的 email 網域 |
| fiction.name_blacklist | 5 個人名 | 不得出現的真實人名 |

來源核對：IDP 聽力頁、EF、Kaplan 三個頁面；看題與檢查時間來自 Kaplan（第三方描述）。尚未直接核對 ielts.org 官網：`<<TBD>>`。

## 附錄 D　主題檔 content/topics/<主題>.json

| 節點 | 型別 | 必填 | 說明 |
|---|---|---|---|
| id | 字串 | 是 | 主題識別 |
| title | 字串 | 是 | 給人看的名稱 |
| section | 整數 | 是 | 適用的 Section |
| speakers[] | 陣列 | 是 | 每項 `{ id, role }`，例如 A＝櫃台職員、B＝民眾 |
| form.title | 字串 | 是 | 題目卷標題（英文） |
| form.instruction | 字串 | 是 | 題目卷說明，驗證器會解析其中的字數上限 |
| form.rows[] | 陣列 | 是 | 表格由上到下的列；順序就是題號與音檔順序 |
| variants[] | 陣列 | 是（至少 2） | 每項 `{ id, setting }` |
| fields_pool[] | 陣列 | 是 | 欄位池 |

**form.rows[] 的兩種列：** 固定印好的列（`label`、`printed`，永遠出現，內容不得與任何答案衝突）；候補空格列（`label`、`field_id`，被抽中才出現）。

**fields_pool[] 每個欄位：**

| 節點 | 必填 | 說明 |
|---|---|---|
| field_id | 是 | 要與 form.rows 的某一列對應 |
| type | 是 | 欄位類型 |
| allowed_traps[] | 是 | 這個欄位允許的陷阱 |
| answer_policy | 是 | 比對規則 |
| max_words | 是 | 答案字數上限（含冠詞與介系詞；連續數字算一個） |
| group | 否 | 成組欄位，同組一起抽或一起不抽 |
| only_variants[] | 否 | 只在這些變體出現 |

## 附錄 E　陷阱配方 content/recipes/section1.json

每個配方為 `{ id, traps }`，6 種陷阱各幾題，加起來必須等於 question_count（10）。

| 配方 | 更正 | 拼字 | 相近數字 | 同義改寫 | 干擾 | 無陷阱 |
|---|---|---|---|---|---|---|
| R1 | 2 | 2 | 2 | 1 | 1 | 2 |
| R2 | 1 | 3 | 2 | 2 | 0 | 2 |
| R3 | 2 | 1 | 3 | 1 | 1 | 2 |

## 附錄 F　比對規則

所有規則先做字串正規化：轉小寫、去頭尾空白、連續空白壓成一個、去結尾標點、統一撇號。不做模糊比對。

| 規則 | 內容 | 例 |
|---|---|---|
| exact_word | 與 answer 或 accepted 逐字相同；連字號等同空白（只在此規則成立）；拼錯就是錯 | Harlow-Road ＝ Harlow Road |
| date_equivalence | 解析成日、月（有年份才比年），順序與序數視為相同 | 14 March ＝ March 14 ＝ 14th of March |
| digits_only | 去掉空白與連字號後比數字；有字母就錯 | 07700 900 123 ＝ 07700900123 |
| number_word | 阿拉伯數字與英文數字詞視為相同，只處理 0 到 20 | 3 ＝ three |

部分答案是否算對：`<<TBD>>`（見 1.4 的 H）。

## 附錄 G　骨架 skeleton.json

| 節點 | 說明 |
|---|---|
| seed | 抽籤種子 |
| topic、variant、recipe | 抽中的主題、變體、配方 |
| slots[] | 10 項，每題一項，見下 |
| artifact | 版本資訊：schema_version、generator_version、inputs.topic／recipes／profile（輸入檔內容的 16 位雜湊） |

slots[] 每項：question_id、field_id、type、trap、answer_policy、max_words、group（可省略）。

結構規則：剛好 10 題；每種陷阱題數等於配方；每個陷阱是該欄位允許的；欄位屬於抽中的變體；題號順序與表格列順序一致；成組欄位不被拆開。

## 附錄 H　答案清單 plan.json

答案與題目結構的唯一來源。

| 節點 | 必填 | 說明 |
|---|---|---|
| set_id | 是 | 題組識別 |
| topic、variant、recipe、seed | 建議 | 抄自骨架 |
| scenario | 否 | `{ setting, accent }`：場景描述與口音 |
| form | 否 | `{ title, instruction }`，抄自主題 |
| answers[] | 是 | 10 項，見下 |

answers[] 每項：

| 節點 | 誰決定 | 說明 |
|---|---|---|
| question_id、field_id、type、trap、answer_policy | 骨架 | 必須與骨架一致 |
| answer | AI | 標準答案，字數不超過欄位上限 |
| accepted[] | AI | 其他可接受的寫法 |
| wrong_value | AI | 只有 self_correction 與 distractor 必填 |
| note | AI | 給人看的備註 |

## 附錄 I　逐字稿 script.json

| 節點 | 說明 |
|---|---|
| set_id | 題組識別 |
| turns[] | 每項 `{ id, speaker, text }` |
| evidence[] | 10 項，每項 `{ question_id, turn, quote }` |

evidence 只是定位索引。驗證器用 turns 的原文核對：`quote` 必須是該輪 text 的原文子字串；答案要依比對規則出現在 quote 所在的句子裡。

## 附錄 J　題目卷 paper.json

| 節點 | 說明 |
|---|---|
| set_id | 題組識別（骨架階段可為 null） |
| type | 目前只有 form_table |
| title、instruction | 抄自主題 |
| rows[] | 每列 `{ label, field_id?, parts[] }`；parts 是文字與空格交錯的陣列：`{ text }` 是印好的字，`{ blank }` 放 question_id；固定列沒有 field_id |

不得洩漏答案：答案不得出現在標題、說明、以及該題所在那一列的標籤與印好的字。別列印好的值剛好等於某題答案，不算洩漏。

## 附錄 K　驗證規則 V1 到 V13

驗證回傳 `{ ok, issues[] }`；issues 每項 `{ rule, level, message, question_id? }`；沒有任何「擋」級問題才是 ok。

| 規則 | 檢查 | 等級 |
|---|---|---|
| V1 | 必要欄位齊全；三份檔案的 question_id、field_id 一致 | 擋 |
| V2 | 剛好 10 題、q01 到 q10 不重複 | 擋 |
| V3a | evidence.quote 是原文子字串 | 擋 |
| V3b | 答案出現在證據句 | 擋 |
| V4 | 證據順序與題號一致 | 擋 |
| V5 | 字數不超過說明與欄位上限 | 擋 |
| V6 | 答案不得出現在學生可見文字 | 擋 |
| V7 | 自我更正與干擾選項的 wrong_value 位置正確 | 擋 |
| V8 | 拼字題有逐字母格式且拼出答案 | 擋 |
| V9 | 相近數字題前後有容易混淆的對應數字 | 擋 |
| V10 | 同一題語境下答案不得碰撞（不同欄位的字面重疊不算） | 擋 |
| V11 | 全文長度約 650 到 800 字（±15%） | 警示 |
| V11 | 題間距至少 25 字；第 1 題前至少 3 輪暖身 | 擋 |
| V12 | 電話、email、人名都是虛構的 | 擋 |
| V13 | 答案清單與骨架一致；骨架符合配方、欄位限制、成組規則 | 擋 |

## 附錄 L　盲答結果 check.json

| 節點 | 說明 |
|---|---|
| set_id | 題組識別 |
| answers[] | 每項：question_id、answer、alternatives[]、confidence（high、medium、low） |

比對規則 B1 到 B3 見 3.5。

## 附錄 M　題組紀錄 meta.json

| 節點 | 說明 |
|---|---|
| set_id、seed | 題組識別與種子 |
| status | 由各階段指紋推導 |
| created_at、updated_at | 時間 |
| schema_version、generator_version | 結構版本、程式版本 |
| inputs | topic、recipes、profile 三個輸入檔的 16 位雜湊 |
| retries | plan、script 各自的重寫次數，上限 2 |
| edits[] | 用 accept 記錄的手改紀錄（階段、備註、時間） |
| stages | 各階段指紋，見下表 |

| 階段 | hash | from（依據的上游） | 其他 |
|---|---|---|---|
| skeleton | 有 | 無 | at |
| paper | 有 | skeleton | at |
| plan | 有 | skeleton | prompt、model、mode、at |
| script | 有 | plan | prompt、model、mode、at |
| validate | 無 | plan、script、paper | ok、block、warn、at |
| blind | 無 | plan、script、paper、check | prompt、model、mode、at |
| review | 無 | script | by、at |

各階段狀態：ok（最新）、stale（過期）、missing（尚無）、failed（驗證失敗）、warned（有警示）。

## 附錄 N　批改

`grade(plan, userAnswers)`：輸入 `{ "q01": "使用者填的字", … }`。輸出：total（答對題數）、results[]（每題 `{ question_id, given, expected, correct, type, trap }`）、byType、byTrap（各 `{ correct, total }`）。

## 附錄 O　時間軸 audio/timing.json（M4，格式暫定）

`set_id`、`turns[]`（每項 `id`、`start`、`end`，單位秒）。

## 附錄 P　測試資料

| 測試 | 預期 |
|---|---|
| good-0001：一份完全正確的題目 | 全部通過 |
| 答案只在 evidence 裡，不在逐字稿 | V3a 或 V3b 失敗 |
| quote 不是原文子字串 | V3a 失敗 |
| 答案出現在題目卷提示文字 | V6 失敗 |
| 自我更正但沒有 wrong_value | V7 失敗 |
| 拼字題沒有逐字母 | V8 失敗 |
| 字數超限 | V5 失敗 |
| 題號順序和音檔順序相反 | V4 失敗 |
| 電話用真實格式 | V12 失敗 |
| 合法：不同欄位的答案 King Street 與 King Street West | V10 通過 |
| 合法：全文只有 600 字 | V11 只出警示 |
| 同一個種子抽兩次 | 骨架相同 |
| 配方要 5 個拼字、欄位池只有 4 個允許拼字 | 回報 NO_ELIGIBLE_CANDIDATE |
| plan 的陷阱與骨架不一致 | V13 失敗 |

目前共 93 個自動測試。

## 附錄 Q　已知風險

- AI 寫的對話可能太書面、太整齊，驗證器抓不到，靠你讀逐字稿與 M4 實際聽。
- 盲答與出題模型可能有相同偏誤，所以盲答只當警示。
- TTS 的拼字與數字念法。
- 題目原創，不複製任何官方題目。
- 表格版面比想像中多樣，第一版只做單欄表格。
- 欄位池太小會讓題目看起來重複。
