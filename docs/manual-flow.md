# 人工模式操作說明：自己出一套題

這是 M2 的流程，AI 的三步（填值、寫逐字稿、盲答）由你把 prompt 貼給 Claude，再把回覆存成檔案。所有指令都在專案根目錄執行。

流程圖見 `docs/gap-fill-module.md` 的 0.1 節。顏色分工：抽籤、組題目卷、驗證是程式；填值、逐字稿、盲答是 AI；最後放行是你。

## 事前

- 題組放在 `content/sets/<題組名>/`，題組名自己取，慣例是 `s1-<主題>-<四位流水號>`，例如 `s1-car-0002`。
- 現有主題：`library-card`（圖書館辦證）、`gym-membership`（健身房入會）、`car-rental`（租車）。主題檔在 `content/topics/`。
- AI 的回覆請存成 `.json` 檔（可以放在 `/tmp`，不必進專案）。**只能有 JSON 本身**，如果 Claude 的回覆有 ```` ``` ```` 或前後說明，要刪掉。

## 步驟

**1. 抽籤（程式）**

```
node generator/cli.mjs draw --seed 20261020 --topic car-rental --out content/sets/s1-car-0002
```

- `--seed` 任意整數，同一個種子會抽出同樣的骨架。`--topic`、`--variant` 可省略，省略就隨機。
- 產生 `skeleton.json`、`paper.json`、`preview.html`、`meta.json`。
- 如果印出 `NO_ELIGIBLE_CANDIDATE`，代表這個主題排不出骨架，換種子或主題。

**2. 填值（AI）**

```
node generator/cli.mjs prompt plan content/sets/s1-car-0002 > /tmp/plan-prompt.md
```

- 把 `/tmp/plan-prompt.md` 的全部內容貼到**新的** Claude 對話。
- 把回覆存成 `/tmp/plan-values.json`，然後組回去：

```
node generator/cli.mjs assemble plan content/sets/s1-car-0002 /tmp/plan-values.json --model "你用的模型名稱"
```

- `--model` 是給指紋紀錄用的，寫你實際用的模型。
- 如果顯示「組裝失敗」，訊息會說缺哪一題或哪裡重複，回到同一個對話請 Claude 修正。

**3. 寫逐字稿（AI）**

```
node generator/cli.mjs prompt script content/sets/s1-car-0002 > /tmp/script-prompt.md
```

- 貼到新的 Claude 對話，回覆存成 `/tmp/script.json`：

```
node generator/cli.mjs assemble script content/sets/s1-car-0002 /tmp/script.json --model "你用的模型名稱"
```

**4. 驗證（程式）**

```
node generator/cli.mjs validate content/sets/s1-car-0002
```

- 顯示「通過」就往下。顯示「擋」，把那幾行錯誤訊息貼回**同一個**對話，說「驗證器擋下了，請整份重寫」，把新回覆再 `assemble script` 一次，然後再驗證。
- 重寫最多 2 次，滿了 `assemble` 會拒絕，這時請人工處理（見下面「手動改檔」）。
- 「警示」不會擋，但請讀一下。

**5. 盲答（AI，必須是另一個新的對話）**

```
node generator/cli.mjs prompt blind content/sets/s1-car-0002 > /tmp/blind-prompt.md
```

- 貼到**全新**的對話，不能用前面用過的，否則它看過答案就失去意義。
- 回覆存成 `/tmp/check.json`：

```
node generator/cli.mjs assemble check content/sets/s1-car-0002 /tmp/check.json --model "你用的模型名稱"
node generator/cli.mjs blind content/sets/s1-car-0002
```

- 沒有警示最好。有警示請逐項看：標準答案太窄、對話有兩個合理答案、陷阱沒生效，都是它想告訴你的事。

**6. 看成品，放行**

```
node generator/cli.mjs preview content/sets/s1-car-0002
```

- 用瀏覽器開 `content/sets/s1-car-0002/preview.html`，可以看到題目卷、逐字稿，陷阱用顏色標出來。
- 確定可用，登記審核：

```
node generator/cli.mjs review content/sets/s1-car-0002 --by 你的名字
```

- 驗證與盲答必須是最新才能審核，盲答有警示可以放行（代表你看過並接受）。

## 隨時查狀態

```
node generator/cli.mjs status content/sets/s1-car-0002
```

逐階段顯示：最新、過期、尚無、未過、有警示，以及重寫次數、誰用什麼模型產的、有沒有被手動修改。

狀態順序：`drawn → planned → scripted → papered → validated → blind_passed → reviewed`。盲答有警示時停在 `validated`。

## 手動改檔

直接改 `plan.json` 或 `script.json` 是允許的，但改完後那個階段與它的下游都會顯示「過期」。處理方式：

```
node generator/cli.mjs accept content/sets/s1-car-0002 script --note "改了什麼"
node generator/cli.mjs validate content/sets/s1-car-0002
```

`accept` 會留下修改紀錄。之後驗證要重跑；逐字稿或答案改了，盲答也要重做（用新的對話）。

## 常見狀況

| 狀況 | 原因與處理 |
|---|---|
| `status` 顯示「prompt 已改」 | 這份題組是用舊版 prompt 產的。可以接受，也可以重跑那一步。 |
| 顯示「prompt 版本未記錄」 | 舊題組補登記的，當時用的版本無從考證，不是錯誤。 |
| `assemble` 拒絕：已重寫 2 次 | 同一步驗證失敗太多次，請手動改檔後 `accept`，或換種子重抽。 |
| 盲答的備選答案只是「少一個字」（例如 `Wrenfield` 對 `Wrenfield Road`） | 部分答案是否算對還沒有定論，目前評分會算錯，先當警示看。 |
