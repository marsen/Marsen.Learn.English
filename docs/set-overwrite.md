# 覆蓋上傳

同一個 `set_id` 再上傳時，上傳頁顯示「已存在」和「覆蓋」按鈕，**按了才寫入**。

**覆蓋＝當成新上傳**，不管改了什麼（包括只補逐字稿）：

- 整套換掉：題目卷、答案、錄音、時間軸、逐字稿、製作紀錄
- 審核狀態：待審；開放對象：下架（跟新上傳一樣，老師通過後再上架）
- 目前老師的審稿意見清掉；「審稿紀錄」的歷史保留
- 錄音換了就另存新檔（`<set_id>/audio-<sha256 前 8 碼>.mp3`），舊檔留著

程式：`src/application/examSet/uploadExamSet.ts`；畫面：`src/presentation/components/admin/BatchUploadForm.tsx`

## 對考試紀錄的影響

- **已經交卷的**：不受影響。交卷時就把分數、每題的作答、對錯和當時的正解一起存了（`exam_attempts.results`）。
- **正在考、還沒交卷的**：交卷時用的是**當下**網站上的答案卡，剛好在他考試中覆蓋了答案，他會用新答案批改。覆蓋後題組會下架、新的人考不到，這種重疊很少見，先不處理；之後做「封存題組」時再一起考慮（`docs/roadmap.md`）。

## 版本

- `exam_sets.schema_minor`（migration `0014`）：0＝2.0（沒有逐字稿）、1＝2.1（有逐字稿）
- 題組清單的「版本」欄看得出哪些題組還沒有逐字稿

## 2.0 補逐字稿（重新打包成 2.1）

1. Question.Generator：主題庫改過的話，舊題組打包前要先認可
   ```bash
   uv run python -m src accept results/sets/<set_id>
   uv run python -m src bundle results/sets/<set_id>
   ```
2. 網站 `/admin/sets/upload` 選 `results/out`（或其中一套），按「上傳」，出現「已存在」就按「覆蓋」
3. 覆蓋後是待審、下架：老師重新審過、通過後再上架
