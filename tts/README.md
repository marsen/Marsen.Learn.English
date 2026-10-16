# M4 錄音試作（Kokoro）

`make_audio.py`：把 `content/sets/<id>/script.json` 做成 `audio/full.mp3` 與 `audio/timing.json`。
停頓點與播報詞由 `paper.json` 的分段與 `script.json` 的 `evidence` 自動推算，不必為新題目改程式。

```
python make_audio.py content/sets/s1-gym-0002 content/sets/s1-gym-0002/audio --pause 20
```

- 環境：Python 3.12、`kokoro-onnx`、`faster-whisper`（ASR 檢查用）、`ffmpeg`；模型檔 `models/kokoro-v1.0.onnx`、`models/voices-v1.0.bin` 放在執行目錄（不進 git）。
- 在 `tts/` 目錄裡執行（需要同目錄的 `asr.py`）。
- 狀態：試作。拼字品質不穩，後續見 `docs/voice-cast-plan.md`。
